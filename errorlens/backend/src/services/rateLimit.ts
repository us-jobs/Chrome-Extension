import { redis } from '../lib/redis';

const DAILY_LIMITS = {
  FREE: 20,
  PRO: Infinity,
  TEAM: Infinity
};

export async function checkAndDecrementRateLimit(
  userId: string,
  plan: 'FREE' | 'PRO' | 'TEAM'
): Promise<boolean> {
  if (plan !== 'FREE') return true;
  
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${userId}:${today}`;
  
  try {
    const current = await redis.get(key);
    const count = parseInt(current || '0');
    
    if (count >= DAILY_LIMITS.FREE) return false;
    
    await redis.set(key, count + 1, 'EX', 86400);
    return true;
  } catch (err) {
    console.error('Redis Rate limit check failed:', err);
    return true; // Fail open
  }
}

export async function getRemainingUsage(userId: string, plan: string): Promise<number> {
  if (plan !== 'FREE') return -1;  // -1 = unlimited
  
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${userId}:${today}`;
  try {
    const current = await redis.get(key);
    return Math.max(0, 20 - parseInt(current || '0'));
  } catch {
    return 20;
  }
}
