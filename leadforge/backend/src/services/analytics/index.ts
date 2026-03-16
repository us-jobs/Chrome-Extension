import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/**
 * 1. Main Dashboard Metrics API
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

  try {
    // 1. Fetch User Data (for credits remaining)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, creditsCarriedOver: true, plan: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Aggregate counts concurrently
    const [totalContacts, activeSequences] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.sequence.count({ where: { userId, status: 'ACTIVE' } }),
    ]);

    // 3. Fetch recent high-intent leads
    const highIntentLeads = await prisma.contact.findMany({
      where: { 
        userId,
        // Assuming intent score is defined out of 100, we consider anything over 80 'high'
        intentScore: { gt: 80 } 
      },
      orderBy: { intentScore: 'desc' },
      take: 5,
      select: { id: true, fullName: true, company: true, title: true, intentScore: true, linkedinUrl: true }
    });

    // 4. Fetch the recent activity feed/audit logs
    const recentActivity = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { contact: { select: { fullName: true, company: true } } }
    });

    res.json({
      metrics: {
        totalContacts,
        activeSequences,
        creditsRemaining: user.credits + user.creditsCarriedOver,
        plan: user.plan
      },
      highIntentLeads,
      recentActivity: recentActivity.map(log => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        metadata: log.metadata,
        contactName: log.contact?.fullName || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('Analytics Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics dashboard data' });
  }
});

export const analyticsRouter = router;
