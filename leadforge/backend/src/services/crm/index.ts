import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/**
 * 1. CRM Connection Stubs
 * In production, this would handle massive OAuth2 flows and token storage
 */
router.post('/connect/:crm', async (req: AuthenticatedRequest, res) => {
  const crm = (req.params.crm as string).toLowerCase(); // 'salesforce' | 'hubspot'
  const userId = req.user!.userId;
  
  // MOCK: Pretend we did OAuth
  console.log(`[CRM] Connecting user ${userId} to ${crm}`);

  res.json({
    success: true,
    message: `Connected securely to ${crm}`,
    crm
  });
});

/**
 * 2. CRM Sync Route
 * Sync a selected LeadForge contact to the connected CRM
 */
router.post('/sync', async (req: AuthenticatedRequest, res) => {
  const { contactId, crm } = req.body;
  const userId = req.user!.userId;

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // MOCK: Pretend we sent data to Salesforce/HubSpot API
    console.log(`[CRM] Syncing contact ${contact.email} to ${crm}`);

    res.json({
      success: true,
      contactId: contact.id,
      crmId: `mock_${crm}_${Date.now()}`
    });

  } catch (error) {
    console.error('CRM Sync Error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export const crmRouter = router;
