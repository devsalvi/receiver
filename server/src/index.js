import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './db/index.js';
import appointmentsRouter from './routes/appointments.js';
import servicesRouter from './routes/services.js';
import barbersRouter from './routes/barbers.js';
import businessRouter from './routes/business.js';
import callsRouter from './routes/calls.js';
import vapiRouter from './routes/vapi.js';
import authRouter from './routes/auth.js';
import { startReminderScheduler } from './services/reminders.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/appointments', appointmentsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/barbers', barbersRouter);
app.use('/api/business', businessRouter);
app.use('/api/calls', callsRouter);
app.use('/api/vapi', vapiRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start reminder scheduler
startReminderScheduler();

app.listen(PORT, () => {
  console.log(`Receiver server running on port ${PORT}`);
});
