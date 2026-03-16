import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRouter from '../services/auth';
import contactsRouter from '../services/contacts';
import { sequenceRouter } from '../services/sequences';
import { crmRouter } from '../services/crm';
import { billingRouter } from '../services/billing';
import { complianceRouter } from '../services/compliance';
import { analyticsRouter } from '../services/analytics';
import aiRouter from '../services/ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.VITE_API_BASE_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth', authRouter);
app.use('/contacts', contactsRouter);
app.use('/sequences', sequenceRouter);
app.use('/crm', crmRouter);
app.use('/billing', billingRouter);
app.use('/compliance', complianceRouter);
app.use('/analytics', analyticsRouter);
app.use('/ai', aiRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`LeadForge API Gateway running on port ${PORT}`);
});

export default app;
