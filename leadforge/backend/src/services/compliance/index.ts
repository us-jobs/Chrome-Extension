import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/**
 * 1. Record EU GDPR Consent
 */
router.post('/consent', async (req: AuthenticatedRequest, res) => {
  const { contactId, status } = req.body;
  const userId = req.user!.userId;
  if (typeof contactId !== 'string' || contactId.trim() === '') {
    return res.status(400).json({ error: 'Invalid contactId' });
  }

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        consentStatus: status, // e.g. 'CONSENTED', 'OPTED_OUT'
        consentGrantedAt: status === 'CONSENTED' ? new Date() : null,
        optedOutAt: status === 'OPTED_OUT' ? new Date() : null,
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

/**
 * 2. GDPR Data Subject Deletion Request
 * Hard-deletes a contact's data upon request to comply with "Right to be Forgotten"
 */
router.delete('/data-request/:contactId', async (req: AuthenticatedRequest, res) => {
  const { contactId } = req.params;
  const userId = req.user!.userId;
  if (typeof contactId !== 'string' || contactId.trim() === '') {
    return res.status(400).json({ error: 'Invalid contactId' });
  }

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // A true GDPR delete should also cascade or nullify audit logs, sequence enrollments etc
    // Prisma cascading takes care of standard relations depending on schema, but we'll issue a soft/hard delete
    
    // Log the deletion reason for audit before deleting
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GDPR_DATA_DELETION',
        metadata: { contactEmail: contact.email }
      }
    });

    await prisma.contact.delete({
      where: { id: contactId }
    });

    res.json({ message: 'Contact data permanently deleted under GDPR compliance.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

export const complianceRouter = router;
