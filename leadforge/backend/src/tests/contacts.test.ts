import request from 'supertest';
import express from 'express';
import contactsRouter from '../services/contacts/index';
import { prismaMock } from './setup';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token, secret, cb) => {
    // If we're using the callback style in middleware
    if (cb) {
      cb(null, { userId: 'user_123', email: 'test@example.com' });
    }
    // If synchronous
    return { userId: 'user_123', email: 'test@example.com' };
  })
}));

const app = express();
app.use(express.json());
app.use('/contacts', contactsRouter);

describe('Contacts Service API', () => {

  describe('GET /contacts', () => {
    it('should return a list of contacts for the authenticated user', async () => {
      
      const mockContacts = [
        { id: '1', fullName: 'Alice Smith', company: 'Acme Corp' },
        { id: '2', fullName: 'Bob Jones', company: 'Globex' }
      ] as any;

      prismaMock.contact.findMany.mockResolvedValue(mockContacts);
      prismaMock.contact.count.mockResolvedValue(2);

      const res = await request(app).get('/contacts')
        .set('Authorization', 'Bearer mock_token');
      
      expect(res.status).toBe(200);
      expect(res.body.contacts.length).toBe(2);
      expect(res.body.total).toBe(2);
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user_123' } })
      );
    });
  });

  describe('DELETE /contacts/:id', () => {
    it('should successfully delete a contact if it belongs to the user', async () => {
      
      prismaMock.contact.findFirst.mockResolvedValue({ id: 'contact_1', userId: 'user_123' } as any);
      prismaMock.contact.delete.mockResolvedValue({ id: 'contact_1' } as any);

      const res = await request(app).delete('/contacts/contact_1')
        .set('Authorization', 'Bearer mock_token');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.contact.delete).toHaveBeenCalledWith({ where: { id: 'contact_1' } });
    });

    it('should return 404 if the contact does not exist or belong to the user', async () => {
      prismaMock.contact.findFirst.mockResolvedValue(null);

      const res = await request(app).delete('/contacts/contact_unknown')
        .set('Authorization', 'Bearer mock_token');
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Contact not found');
      expect(prismaMock.contact.delete).not.toHaveBeenCalled();
    });
  });

});
