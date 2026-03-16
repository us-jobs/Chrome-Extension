import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Exported mock prisma instance
export const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn(() => prismaMock),
    // Mock Enums that might be needed in tests
    Plan: { FREE: 'FREE', PRO: 'PRO', TEAM: 'TEAM', ENTERPRISE: 'ENTERPRISE' },
    ContactSource: { LINKEDIN: 'LINKEDIN', MANUAL: 'MANUAL', WEBSITE: 'WEBSITE' }
  };
});

beforeEach(() => {
  mockReset(prismaMock);
});
