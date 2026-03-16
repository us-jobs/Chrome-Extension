import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { authenticateToken, AuthenticatedRequest } from './middleware';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL || `${API_BASE_URL}/auth/google/callback`;

const getOAuthClient = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL);
};

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;
  
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash
      }
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    res.json({ user, accessToken, refreshToken });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Failed to register user',
      detail: String(error),
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    res.json({ user, accessToken, refreshToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Failed to login',
      detail: String(error),
    });
  }
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const tokens = generateTokens(payload.userId);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, geminiApiKey: true, plan: true, credits: true, creditsCarriedOver: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

router.put('/settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { geminiApiKey } = req.body || {};
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { geminiApiKey: typeof geminiApiKey === 'string' ? geminiApiKey.trim() : null },
      select: { id: true, email: true, name: true, geminiApiKey: true },
    });
    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/google', (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) {
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
    state,
  });

  return res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const oauthClient = getOAuthClient();
  if (!oauthClient) {
    return res.status(500).send('Google OAuth is not configured');
  }

  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing OAuth code');
  }

  if (!state || typeof state !== 'string' || !cookieState || state !== cookieState) {
    return res.status(400).send('Invalid OAuth state');
  }

  try {
    res.clearCookie('oauth_state');

    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.id_token) {
      return res.status(400).send('Missing id_token from Google');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;

    if (!email) {
      return res.status(400).send('Google account missing email');
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const displayName = payload?.name || email.split('@')[0] || 'Google User';
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash,
        },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    const responsePayload = {
      type: 'leadforge:oauth',
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LeadForge - Google Sign-In</title>
  </head>
  <body>
    <script>
      (function () {
        const payload = ${JSON.stringify(responsePayload)};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          window.close();
          return;
        }
        document.body.textContent = 'Signed in. You can close this window.';
      })();
    </script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    return res.status(500).send('Failed to complete Google sign-in');
  }
});

export default router;
