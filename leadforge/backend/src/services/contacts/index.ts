import { Router } from 'express';
import { PrismaClient, ContactSource, Contact } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { findDuplicateContact, mergeContactData } from './deduplication';
import { enrichContactAsync } from '../enrichment';

const router = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all contact routes
router.use(authenticateToken);

// Create a new contact
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const {
      firstName,
      lastName,
      fullName,
      title,
      company,
      companyDomain,
      email,
      phone,
      linkedinUrl,
      source
    } = req.body;

    if (!firstName || !lastName || !source) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, source' });
    }

    const payload = {
      userId,
      firstName,
      lastName,
      fullName: fullName || `${firstName} ${lastName}`,
      title,
      company,
      companyDomain,
      email,
      phone,
      linkedinUrl,
      source: source as ContactSource
    };

    // 1. Run Deduplication Engine
    const duplicate = await findDuplicateContact(userId, payload);
    
    let contact: Contact;
    if (duplicate) {
      // Merge new data into existing contact
      contact = await mergeContactData(duplicate.id, payload);
    } else {
      // Create new
      contact = await prisma.contact.create({
        data: payload
      });
    }

    // 2. Trigger async background enrichment
    // We intentionally don't await this to ensure the API stays fast (>200ms)
    enrichContactAsync(contact.id).catch(console.error);

    res.status(201).json({
      contact,
      status: duplicate ? 'merged' : 'created'
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// Get all contacts for user (with optional pagination/filtering)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { skip, take, search } = req.query;

    const whereClause: any = { userId };
    
    if (search) {
      whereClause.OR = [
        { fullName: { contains: String(search), mode: 'insensitive' } },
        { company: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      skip: skip ? parseInt(String(skip)) : 0,
      take: take ? parseInt(String(take)) : 50,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.contact.count({ where: whereClause });

    res.json({ contacts, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get a single contact
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const contact = await prisma.contact.findFirst({
      where: { id, userId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Update a contact
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    
    // Ensure contact exists and belongs to user
    const existing = await prisma.contact.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: req.body
    });

    res.json(updatedContact);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete a contact
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    
    const existing = await prisma.contact.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
