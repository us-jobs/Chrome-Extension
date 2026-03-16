import { Router } from 'express';
import { PrismaClient, Plan } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import Stripe from 'stripe';

const router = Router();
const prisma = new PrismaClient();

// Setup Stripe with dummy key fallback for dev
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2025-02-24.acacia' as any, // Cast to any to bypass strict literal type matching
});

router.use(authenticateToken);

/**
 * Get current billing status
 */
router.get('/status', async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { plan: true, credits: true, creditsCarriedOver: true }
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

/**
 * Create a Stripe Checkout Session to upgrade to a paid plan
 */
router.post('/upgrade', async (req: AuthenticatedRequest, res) => {
  const { plan } = req.body; // 'PRO' | 'TEAM'
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // MOCK: Defining static price IDs
    const prices = {
      'PRO': 'price_pro_subscription',
      'TEAM': 'price_team_subscription'
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: prices[plan as keyof typeof prices],
        quantity: 1,
      }],
      client_reference_id: userId,
      customer_email: user?.email,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export const billingRouter = router;
