import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { OAuth2Client } from 'google-auth-library';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

function generateTokens(user: any) {
  const payload = { id: user.id, plan: user.plan };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

router.post('/google', async (req: Request, res: Response): Promise<any> => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("No payload");

    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name,
          avatarUrl: payload.picture
        }
      });
    }

    const tokens = generateTokens(user);
    res.json({ ...tokens, user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

router.post('/refresh', (req: Request, res: Response): any => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const accessToken = jwt.sign({ id: decoded.id, plan: decoded.plan }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/guest', (req: Request, res: Response) => {
  const guestToken = jwt.sign({ id: req.ip, plan: 'FREE' }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ guestToken });
});

export { router as authRouter };
