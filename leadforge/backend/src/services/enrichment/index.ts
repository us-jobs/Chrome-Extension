import { PrismaClient, Contact } from '@prisma/client';
import { verifyEmail, validatePhone } from '../verification';

const prisma = new PrismaClient();

/**
 * 1. Clearbit API Stub
 */
async function fetchClearbitData(domain: string) {
  console.log(`[Enrichment] Fetching Clearbit data for ${domain}`);
  // Mock external API call
  return {
    companySize: '51-200',
    companyIndustry: 'Information Technology',
    companyFunding: 'Series B',
    companyTechStack: ['React', 'Node.js', 'PostgreSQL', 'AWS']
  };
}

/**
 * 2. People Data Labs API Stub
 */
async function fetchPDLData(email?: string, linkedinUrl?: string) {
  console.log(`[Enrichment] Fetching PDL data for ${email || linkedinUrl}`);
  // Mock external API call
  return {
    intentScore: Math.floor(Math.random() * (100 - 50 + 1) + 50), // Random 50-100
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    seniority: 'Director'
  };
}

/**
 * 3. Main async background processor
 * This function should ideally be processed by BullMQ/Redis worker in production
 */
export async function enrichContactAsync(contactId: string) {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      console.warn(`[Enrichment] Contact ${contactId} not found`);
      return;
    }

    console.log(`[Enrichment] Starting pipeline for Contact: ${contact.id}`);

    const [clearbit, pdl] = await Promise.allSettled([
      contact.companyDomain ? fetchClearbitData(contact.companyDomain) : Promise.resolve({}),
      fetchPDLData(contact.email || undefined, contact.linkedinUrl || undefined)
    ]);

    const enrichedData: Partial<Contact> = {};

    // Merge Clearbit Data
    if (clearbit.status === 'fulfilled' && Object.keys(clearbit.value).length > 0) {
      Object.assign(enrichedData, clearbit.value);
    }

    // Merge PDL Data
    if (pdl.status === 'fulfilled' && Object.keys(pdl.value).length > 0) {
      Object.assign(enrichedData, pdl.value);
    }

    // Verification Step - Emails
    if (contact.email && contact.emailStatus === 'UNVERIFIED') {
      const emailRes = await verifyEmail(contact.email);
      enrichedData.emailStatus = emailRes.status;
      enrichedData.emailVerifiedAt = new Date();
    }

    // Verification Step - Phones
    if (contact.phone && !contact.phoneValidatedAt) {
      const phoneRes = await validatePhone(contact.phone);
      enrichedData.phoneValid = phoneRes.isValid;
      if (phoneRes.type) enrichedData.phoneType = phoneRes.type;
      enrichedData.phoneValidatedAt = new Date();
    }

    // Determine GDPR status
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO'];
    if (enrichedData.country && euCountries.includes(enrichedData.country.toUpperCase())) {
      enrichedData.gdprSubject = true;
    }

    // Update the database record
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        ...enrichedData,
        lastEnrichedAt: new Date(),
        completenessScore: calculateCompleteness({ ...contact, ...enrichedData })
      }
    });

    console.log(`[Enrichment] Pipeline completed for Contact: ${contact.id}`);
  } catch (error) {
    console.error(`[Enrichment] Failed for ${contactId}:`, error);
  }
}

/**
 * Basic heuristic to give users a 'quality' score for the captured data
 */
function calculateCompleteness(data: Partial<Contact>): number {
  let score = 0;
  if (data.firstName && data.lastName) score += 15;
  if (data.email) score += 25;
  if (data.phone) score += 15;
  if (data.linkedinUrl) score += 10;
  if (data.company) score += 10;
  if (data.title) score += 10;
  if (data.city || data.state) score += 5;
  if (data.companyIndustry) score += 10;
  return Math.min(score, 100);
}
