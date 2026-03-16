import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { getRemainingUsage } from '../services/rateLimit';

const router = Router();

router.get('/', verifyToken, async (req: Request, res: Response) => {
  const userId = req.user?.id || req.ip || 'unknownIP';
  const plan = req.user?.plan || 'FREE';
  
  const remaining = await getRemainingUsage(userId, plan);
  
  res.json({
    plan,
    remaining
  });
});

export { router as usageRouter };
