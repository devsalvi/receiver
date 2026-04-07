import cron from 'node-cron';
import db from '../db/index.js';
import { sendReminderSMS } from './sms.js';

// Schedule reminders for an appointment (T-24h and T-2h)
export function scheduleReminders(appointmentId, startTime) {
  const start = new Date(startTime);

  const reminder24h = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const reminder2h = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  const now = new Date();

  if (reminder24h > now) {
    db.prepare('INSERT INTO reminders (appointment_id, reminder_type, scheduled_for) VALUES (?, ?, ?)')
      .run(appointmentId, 'reminder_24h', reminder24h.toISOString());
  }

  if (reminder2h > now) {
    db.prepare('INSERT INTO reminders (appointment_id, reminder_type, scheduled_for) VALUES (?, ?, ?)')
      .run(appointmentId, 'reminder_2h', reminder2h.toISOString());
  }
}

// Check and send due reminders — runs every minute
export function startReminderScheduler() {
  cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();

    const dueReminders = db.prepare(`
      SELECT r.*, a.start_time, a.status as apt_status, a.service_id, a.customer_id
      FROM reminders r
      JOIN appointments a ON r.appointment_id = a.id
      WHERE r.sent = 0 AND r.scheduled_for <= ? AND a.status = 'confirmed'
    `).all(now);

    for (const reminder of dueReminders) {
      try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(reminder.customer_id);
        const service = reminder.service_id
          ? db.prepare('SELECT * FROM services WHERE id = ?').get(reminder.service_id)
          : null;
        const business = db.prepare('SELECT name FROM business WHERE id = 1').get();

        if (customer) {
          await sendReminderSMS(customer.phone, {
            customerName: customer.first_name,
            serviceName: service ? service.name : 'appointment',
            startTime: reminder.start_time,
            businessName: business?.name,
            reminderType: reminder.reminder_type
          });
        }

        db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(reminder.id);
      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err.message);
      }
    }
  });

  console.log('Reminder scheduler started');
}
