import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './db/index.js';
import { requireAuth, requireSuperAdmin } from './middleware/auth.js';
import adminRouter from './routes/admin.js';
import appointmentsRouter from './routes/appointments.js';
import servicesRouter from './routes/services.js';
import barbersRouter from './routes/barbers.js';
import businessRouter from './routes/business.js';
import callsRouter from './routes/calls.js';
import vapiRouter from './routes/vapi.js';
import elevenlabsRouter from './routes/elevenlabs.js';
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import { startReminderScheduler } from './services/reminders.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    process.env.APP_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'https://master.d1jxovvwswacpk.amplifyapp.com',
    'https://ar8nn37487.execute-api.us-east-1.amazonaws.com',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes (no auth required)
app.use('/api/vapi', vapiRouter);
app.use('/api/elevenlabs', elevenlabsRouter);
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Super admin routes
app.use('/api/admin', requireSuperAdmin, adminRouter);

// Store admin routes (require Cognito JWT with store_id)
app.use('/api/appointments', requireAuth, appointmentsRouter);
app.use('/api/services', requireAuth, servicesRouter);
app.use('/api/barbers', requireAuth, barbersRouter);
app.use('/api/business', requireAuth, businessRouter);
app.use('/api/calls', requireAuth, callsRouter);

// Start reminder scheduler
startReminderScheduler();

app.listen(PORT, () => {
  console.log(`Receiver server running on port ${PORT}`);
});
