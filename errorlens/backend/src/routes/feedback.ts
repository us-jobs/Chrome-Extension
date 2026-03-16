import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', verifyToken, async (req: Request, res: Response): Promise<any> => {
  if (!req.user || req.isGuest) {
    return res.status(401).json({ error: 'Must be logged in to leave feedback' });
  }

  const { explanationId, rating, comment } = req.body;

  if (!explanationId || !['THUMBS_UP', 'THUMBS_DOWN'].includes(rating)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const feedback = await prisma.feedback.upsert({
      where: { explanationId },
      update: { rating, comment },
      create: {
        userId: req.user.id,
        explanationId,
        rating,
        comment
      }
    });
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export { router as feedbackRouter };
