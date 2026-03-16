import { EmailStatus, PhoneType } from '@prisma/client';

export interface EmailVerificationResult {
  status: EmailStatus;
  isValid: boolean;
  score: number;
  reason?: string;
}

export interface PhoneValidationResult {
  isValid: boolean;
  type: PhoneType;
  countryCode?: string;
  carrier?: string;
}

/**
 * Basic syntax and role-based blocklist checks
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: EmailStatus.INVALID, isValid: false, score: 0, reason: 'Invalid Syntax' };
  }

  const roleBasedPrefixes = ['info', 'admin', 'support', 'sales', 'contact', 'hello'];
  const localPart = email.split('@')[0].toLowerCase();

  if (roleBasedPrefixes.includes(localPart)) {
    return { status: EmailStatus.RISKY, isValid: true, score: 50, reason: 'Role-based email' };
  }

  // TODO: Implement actual Hunter.io / SMTP Verification API Calls here
  console.log(`[Verification] Mock verifying email: ${email}`);

  return { status: EmailStatus.VALID, isValid: true, score: 95 };
}


/**
 * Twilio Phone Validation Stub
 */
export async function validatePhone(phone: string): Promise<PhoneValidationResult> {
  // TODO: Implement actual Twilio Lookup API Call here
  console.log(`[Verification] Mock validating phone: ${phone}`);

  if (phone.length < 10) {
    return { isValid: false, type: PhoneType.UNKNOWN };
  }

  // Mock valid mobile number
  return {
    isValid: true,
    type: PhoneType.MOBILE,
    countryCode: 'US',
    carrier: 'Verizon'
  };
}
