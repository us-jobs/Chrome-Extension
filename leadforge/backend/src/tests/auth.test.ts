import request from 'supertest';
import express from 'express';
import authRouter from '../services/auth/index';
import { prismaMock } from './setup';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn().mockReturnValue({ userId: 'user_123' })
}));

// Setup isolated express app for testing the route
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('Auth Service API', () => {

  describe('POST /auth/register', () => {
    it('should successfully register a new user and return tokens', async () => {
      // Mock prisma lookups
      prismaMock.user.findUnique.mockResolvedValue(null); // No existing user
      prismaMock.user.create.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        plan: 'FREE',
        credits: 50,
        creditsCarriedOver: 0,
        createdAt: new Date()
      } as any);

      const res = await request(app)
        .post('/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('test@example.com');
      
      // Verify prisma was called correctly
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });

    it('should return 409 if user already exists', async () => {
      // Mock existing user
      prismaMock.user.findUnique.mockResolvedValue({ id: 'exists' } as any);

      const res = await request(app)
        .post('/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error', 'User already exists');
    });
  });

});
