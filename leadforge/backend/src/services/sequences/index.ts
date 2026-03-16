import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Create a new sequence
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, steps } = req.body;

    const sequence = await prisma.sequence.create({
      data: {
        userId,
        name,
        steps: steps // JSON array
      }
    });

    res.status(201).json(sequence);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

// Get user's sequences
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const sequences = await prisma.sequence.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(sequences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

export const sequenceRouter = router;
