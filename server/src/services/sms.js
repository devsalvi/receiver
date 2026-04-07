import twilio from 'twilio';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export async function sendConfirmationSMS(phone, { customerName, serviceName, startTime, businessName }) {
  const body = `Hi ${customerName}! Your ${serviceName} at ${businessName || 'the shop'} is confirmed for ${formatDateTime(startTime)}. Reply CANCEL to cancel.`;
  return sendSMS(phone, body, 'confirmation');
}

export async function sendReminderSMS(phone, { customerName, serviceName, startTime, businessName, reminderType }) {
  const timeLabel = reminderType === 'reminder_24h' ? 'tomorrow' : 'in 2 hours';
  const body = `Hi ${customerName}! Reminder: your ${serviceName} at ${businessName || 'the shop'} is ${timeLabel} at ${formatDateTime(startTime)}. See you soon!`;
  return sendSMS(phone, body, reminderType);
}

async function sendSMS(to, body, messageType, appointmentId) {
  const client = getClient();
  const logId = uuid();

  if (!client) {
    console.log(`[SMS-MOCK] To: ${to} | ${body}`);
    db.prepare(`
      INSERT INTO sms_logs (id, appointment_id, customer_phone, message_type, message_body, status)
      VALUES (?, ?, ?, ?, ?, 'sent')
    `).run(logId, appointmentId || null, to, messageType, body);
    return logId;
  }

  try {
    const message = await client.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body
    });

    db.prepare(`
      INSERT INTO sms_logs (id, appointment_id, customer_phone, message_type, message_body, twilio_sid, status)
      VALUES (?, ?, ?, ?, ?, ?, 'sent')
    `).run(logId, appointmentId || null, to, messageType, body, message.sid);

    return logId;
  } catch (err) {
    console.error('SMS send error:', err.message);
    db.prepare(`
      INSERT INTO sms_logs (id, appointment_id, customer_phone, message_type, message_body, status)
      VALUES (?, ?, ?, ?, ?, 'failed')
    `).run(logId, appointmentId || null, to, messageType, body);
    throw err;
  }
}
