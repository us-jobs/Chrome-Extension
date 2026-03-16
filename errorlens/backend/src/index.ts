import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { explainRouter } from './routes/explain';

const app = express();

app.use(cors({
  origin: [
    'chrome-extension://*',
    'http://localhost:5173'
  ],
  credentials: true
}));

app.use(express.json());

import { authRouter } from './routes/auth';
import { usageRouter } from './routes/usage';
import { historyRouter } from './routes/history';
import { feedbackRouter } from './routes/feedback';

// Routes
app.use('/explain', explainRouter);
app.use('/auth', authRouter);
app.use('/usage', usageRouter);
app.use('/history', historyRouter);
app.use('/feedback', feedbackRouter);

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ErrorLens API running on port ${PORT}`));

export default app;
