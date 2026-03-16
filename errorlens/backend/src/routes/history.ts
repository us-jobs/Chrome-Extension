import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', verifyToken, async (req: Request, res: Response): Promise<any> => {
  if (!req.user || req.isGuest) {
    return res.json([]);
  }

  const history = await prisma.explanation.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  res.json(history);
});

router.delete('/:id', verifyToken, async (req: Request, res: Response): Promise<any> => {
  if (!req.user || req.isGuest) {
    return res.status(401).json({ error: 'Must be logged in' });
  }

  await prisma.explanation.deleteMany({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  res.json({ success: true });
});

export { router as historyRouter };
