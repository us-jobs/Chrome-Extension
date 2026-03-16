import { PrismaClient, Contact } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deduplication Engine
 * Matches contacts in order of confidence:
 * 1. Exact Email
 * 2. Exact LinkedIn URL
 * 3. Exact Phone Number
 * 4. Fuzzy Name + Domain (simplified exact match for Phase 3)
 */
export async function findDuplicateContact(userId: string, data: Partial<Contact>): Promise<Contact | null> {
  
  // 1. Exact Email Match
  if (data.email) {
    const byEmail = await prisma.contact.findFirst({
      where: { userId, email: data.email }
    });
    if (byEmail) return byEmail;
  }

  // 2. Exact LinkedIn URL Match
  if (data.linkedinUrl) {
    const byLinkedin = await prisma.contact.findFirst({
      where: { userId, linkedinUrl: data.linkedinUrl }
    });
    if (byLinkedin) return byLinkedin;
  }

  // 3. Exact Phone Number
  if (data.phone) {
    const byPhone = await prisma.contact.findFirst({
      where: { userId, phone: data.phone }
    });
    if (byPhone) return byPhone;
  }

  // 4. Name + Domain Match
  if (data.firstName && data.lastName && data.companyDomain) {
    const byNameDomain = await prisma.contact.findFirst({
      where: {
        userId,
        firstName: { equals: data.firstName, mode: 'insensitive' },
        lastName: { equals: data.lastName, mode: 'insensitive' },
        companyDomain: { equals: data.companyDomain, mode: 'insensitive' }
      }
    });
    if (byNameDomain) return byNameDomain;
  }

  return null;
}

/**
 * Merges new data into an existing contact, taking the most recently provided non-null fields
 */
export async function mergeContactData(existingId: string, newData: Partial<Contact>): Promise<Contact> {
  const existing = await prisma.contact.findUnique({ where: { id: existingId } });
  if (!existing) throw new Error('Existing contact not found during merge');

  // Simple merge logic: overwrite nulls or keep existing if robust.
  // In a real system, timestamps per field are needed to resolve conflicts accurately.
  
  const mergedData = {
    ...newData
  };

  // We don't want to overwrite a valid email with a null one.
  if (!newData.email) delete mergedData.email;
  if (!newData.phone) delete mergedData.phone;
  if (!newData.linkedinUrl) delete mergedData.linkedinUrl;

  const updated = await prisma.contact.update({
    where: { id: existingId },
    data: mergedData
  });

  return updated;
}
