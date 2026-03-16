import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { checkAndDecrementRateLimit } from '../services/rateLimit';
import { streamExplanation } from '../services/gemini';
import { buildPrompt } from '../services/prompt';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', verifyToken, async (req: Request, res: Response): Promise<any> => {
  const { error, stackTrace, url, userAgent } = req.body;
  const userId = req.user?.id || req.ip;

  if (!error || typeof error !== 'string') {
    return res.status(400).json({ error: 'error field is required' });
  }

  // Check rate limit
  const allowed = await checkAndDecrementRateLimit(userId || 'unknown', req.user?.plan || 'FREE');
  if (!allowed) {
    return res.status(429).json({
      error: 'Daily limit reached',
      message: 'You have used all 20 free explanations today. Upgrade to Pro for unlimited access.',
      upgradeUrl: 'https://errorlens.dev/upgrade'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const prompt = buildPrompt({ error, stackTrace, url, userAgent });

  let fullResponse = '';

  try {
    const stream = streamExplanation(prompt);
    
    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    
    res.write(`data: [DONE]\n\n`);
    res.end();

    // Save to history async (non-blocking)
    if (req.user?.id) {
      prisma.explanation.create({
        data: {
          userId: req.user.id,
          errorText: error.slice(0, 500),
          stackTrace: JSON.stringify(stackTrace || []),
          explanation: fullResponse,
          pageUrl: url || '',
        }
      }).catch(console.error);
    }

  } catch (err: any) {
    console.error('Gemini stream error:', err);
    res.write(`data: ${JSON.stringify({ error: 'AI service error. Please try again.' })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

export { router as explainRouter };
