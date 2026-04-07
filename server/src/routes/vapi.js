import { Router } from 'express';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { sendConfirmationSMS } from '../services/sms.js';
import { createGoogleCalendarEvent } from '../services/calendar.js';
import { scheduleReminders } from '../services/reminders.js';

const router = Router();

// Vapi webhook — receives server messages from the voice assistant
router.post('/webhook', async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: 'No message' });

  switch (message.type) {
    case 'assistant-request':
      return handleAssistantRequest(req, res);
    case 'function-call':
      return handleFunctionCall(req, res);
    case 'end-of-call-report':
      return handleEndOfCall(req, res);
    case 'status-update':
      return handleStatusUpdate(req, res);
    default:
      return res.json({ ok: true });
  }
});

// Returns the assistant configuration when a call comes in
function handleAssistantRequest(req, res) {
  const business = db.prepare('SELECT * FROM business WHERE id = 1').get();
  const services = db.prepare('SELECT * FROM services WHERE active = 1').all();
  const barbers = db.prepare('SELECT * FROM barbers WHERE active = 1').all();

  const serviceList = services.map(s =>
    `- ${s.name} (${s.duration_minutes} min, $${(s.price_cents / 100).toFixed(2)})`
  ).join('\n');

  const barberList = barbers.filter(b => b.id !== 'barber_default').map(b => `- ${b.name}`).join('\n');

  const greeting = (business.greeting_message || "Hi, this is {shop_name}. I'm an AI assistant — I can book your appointment.")
    .replace('{shop_name}', business.name);

  const systemPrompt = `You are a friendly, professional AI receptionist for ${business.name}, a barber shop.

Your job is to help callers book appointments. Be conversational but efficient — aim to complete bookings in under 2 minutes.

AVAILABLE SERVICES:
${serviceList}

${barberList ? `BARBERS:\n${barberList}\n` : ''}

BOOKING FLOW:
1. Greet the caller warmly
2. Ask what service they'd like
3. Ask if they have a preferred barber (if multiple barbers available)
4. Ask for their preferred date and time
5. Check availability using the check_availability function
6. Offer 2-3 available slots if their preferred time isn't available
7. Once they pick a slot, ask for their first name and confirm their phone number
8. Read back the full booking summary: service, barber, date, time, name
9. Ask them to confirm
10. Book the appointment using the book_appointment function
11. Let them know they'll receive an SMS confirmation

IMPORTANT RULES:
- Only book within business hours
- Always confirm the full booking details before finalizing
- If the caller asks about something you can't help with (pricing questions, walk-ins, etc.), politely let them know and suggest they call back during business hours to speak with someone
- Be natural and conversational, not robotic
- If the caller seems confused or frustrated, offer to help step by step`;

  res.json({
    assistant: {
      firstMessage: greeting,
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        functions: [
          {
            name: 'check_availability',
            description: 'Check available appointment slots for a given date and optional barber',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                barber_name: { type: 'string', description: 'Optional barber name preference' }
              },
              required: ['date']
            }
          },
          {
            name: 'book_appointment',
            description: 'Book an appointment after the customer has confirmed all details',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { type: 'string', description: 'Customer first name' },
                customer_phone: { type: 'string', description: 'Customer phone number' },
                service_name: { type: 'string', description: 'Name of the service' },
                barber_name: { type: 'string', description: 'Name of the barber (or "any")' },
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                time: { type: 'string', description: 'Time in HH:MM format (24h)' }
              },
              required: ['customer_name', 'customer_phone', 'service_name', 'date', 'time']
            }
          }
        ]
      },
      voice: {
        provider: 'eleven-labs',
        voiceId: 'josh'
      }
    }
  });
}

// Handle function calls from the voice assistant
async function handleFunctionCall(req, res) {
  const { message } = req.body;
  const { functionCall } = message;

  if (!functionCall) return res.json({ result: 'No function call found' });

  switch (functionCall.name) {
    case 'check_availability':
      return handleCheckAvailability(functionCall.parameters, res);
    case 'book_appointment':
      return handleBookAppointment(functionCall.parameters, req, res);
    default:
      return res.json({ result: 'Unknown function' });
  }
}

function handleCheckAvailability(params, res) {
  const { date, barber_name } = params;
  const dayOfWeek = new Date(date).getDay();

  const hours = db.prepare('SELECT * FROM business_hours WHERE day_of_week = ?').get(dayOfWeek);
  if (!hours || hours.is_closed) {
    return res.json({ result: `Sorry, we're closed on that day. We're open Monday through Saturday.` });
  }

  // Find barber ID if specified
  let barberId = null;
  if (barber_name && barber_name.toLowerCase() !== 'any') {
    const barber = db.prepare('SELECT * FROM barbers WHERE LOWER(name) LIKE ? AND active = 1')
      .get(`%${barber_name.toLowerCase()}%`);
    if (barber) barberId = barber.id;
  }

  // Get booked slots
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  let aptQuery = "SELECT start_time, end_time FROM appointments WHERE status = 'confirmed' AND start_time >= ? AND start_time <= ?";
  const aptParams = [dateStart, dateEnd];
  if (barberId) { aptQuery += ' AND barber_id = ?'; aptParams.push(barberId); }

  const booked = db.prepare(aptQuery).all(...aptParams);

  // Generate available slots
  const [openH, openM] = hours.open_time.split(':').map(Number);
  const [closeH, closeM] = hours.close_time.split(':').map(Number);
  const available = [];

  for (let h = openH; h < closeH || (h === closeH && 0 < closeM); h++) {
    for (let m = (h === openH ? openM : 0); m < 60; m += 30) {
      if (h === closeH && m >= closeM) break;
      const slotStart = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      const slotEnd = new Date(new Date(slotStart).getTime() + 30 * 60000).toISOString();
      const isBooked = booked.some(b => b.start_time < slotEnd && b.end_time > slotStart);
      if (!isBooked) {
        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        available.push(`${hour12}:${String(m).padStart(2, '0')} ${ampm}`);
      }
    }
  }

  if (available.length === 0) {
    return res.json({ result: `Sorry, there are no available slots on ${date}. Would you like to try a different day?` });
  }

  // Return a subset for voice readability
  const slotsToShow = available.length > 6
    ? `We have ${available.length} slots available. Some options: ${available.slice(0, 3).join(', ')}, or later at ${available.slice(-3).join(', ')}.`
    : `Available times: ${available.join(', ')}.`;

  return res.json({ result: slotsToShow });
}

async function handleBookAppointment(params, req, res) {
  const { customer_name, customer_phone, service_name, barber_name, date, time } = params;

  // Find service
  const service = db.prepare('SELECT * FROM services WHERE LOWER(name) LIKE ? AND active = 1')
    .get(`%${service_name.toLowerCase()}%`);

  // Find barber
  let barber = null;
  if (barber_name && barber_name.toLowerCase() !== 'any') {
    barber = db.prepare('SELECT * FROM barbers WHERE LOWER(name) LIKE ? AND active = 1')
      .get(`%${barber_name.toLowerCase()}%`);
  }
  const barberId = barber ? barber.id : 'barber_default';

  // Build start/end time
  const startTime = `${date}T${time}:00`;
  const durationMinutes = service ? service.duration_minutes : 30;
  const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString();

  // Check conflict
  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE barber_id = ? AND status = 'confirmed'
    AND start_time < ? AND end_time > ?
  `).get(barberId, endTime, startTime);

  if (conflict) {
    return res.json({ result: "I'm sorry, that slot was just taken. Would you like to pick another time?" });
  }

  // Find or create customer
  const cleanPhone = customer_phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;

  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(formattedPhone);
  if (!customer) {
    const customerId = uuid();
    db.prepare('INSERT INTO customers (id, first_name, phone) VALUES (?, ?, ?)')
      .run(customerId, customer_name, formattedPhone);
    customer = { id: customerId, first_name: customer_name, phone: formattedPhone };
  }

  // Create appointment
  const appointmentId = uuid();
  db.prepare(`
    INSERT INTO appointments (id, customer_id, barber_id, service_id, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(appointmentId, customer.id, barberId, service?.id, startTime, endTime);

  // Link call to appointment
  const vapiCallId = req.body.message?.call?.id;
  if (vapiCallId) {
    db.prepare('UPDATE calls SET appointment_id = ?, customer_id = ? WHERE vapi_call_id = ?')
      .run(appointmentId, customer.id, vapiCallId);
  }

  // Google Calendar sync
  const business = db.prepare('SELECT name FROM business WHERE id = 1').get();
  try {
    const eventId = await createGoogleCalendarEvent({
      summary: `${customer_name} - ${service ? service.name : 'Appointment'}`,
      start: startTime,
      end: endTime,
      description: `Customer: ${customer_name}\nPhone: ${formattedPhone}`
    });
    if (eventId) {
      db.prepare('UPDATE appointments SET google_event_id = ? WHERE id = ?').run(eventId, appointmentId);
    }
  } catch (err) {
    console.error('Calendar sync failed:', err.message);
  }

  // SMS confirmation
  try {
    await sendConfirmationSMS(formattedPhone, {
      customerName: customer_name,
      serviceName: service ? service.name : 'Appointment',
      startTime,
      businessName: business?.name
    });
  } catch (err) {
    console.error('SMS failed:', err.message);
  }

  // Schedule reminders
  scheduleReminders(appointmentId, startTime);

  const hour = parseInt(time.split(':')[0]);
  const minute = time.split(':')[1];
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';

  return res.json({
    result: `Your appointment has been booked. ${customer_name}, you're all set for ${service ? service.name : 'your appointment'} on ${date} at ${hour12}:${minute} ${ampm}. You'll receive a text confirmation shortly.`
  });
}

// Handle end-of-call report — save transcript and call metadata
function handleEndOfCall(req, res) {
  const { message } = req.body;
  const call = message.call || {};
  const callId = uuid();

  db.prepare(`
    INSERT INTO calls (id, vapi_call_id, customer_phone, status, duration_seconds, transcript, recording_url, summary, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    callId,
    call.id || null,
    call.customer?.number || null,
    'completed',
    message.durationSeconds || null,
    message.transcript || null,
    message.recordingUrl || null,
    message.summary || null,
    call.startedAt || new Date().toISOString(),
    call.endedAt || new Date().toISOString()
  );

  res.json({ ok: true });
}

// Handle status updates (call started, ringing, etc.)
function handleStatusUpdate(req, res) {
  const { message } = req.body;
  const call = message.call || {};

  if (message.status === 'in-progress' && call.id) {
    // Create initial call record
    const existing = db.prepare('SELECT id FROM calls WHERE vapi_call_id = ?').get(call.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO calls (id, vapi_call_id, customer_phone, status, started_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuid(), call.id, call.customer?.number || null, 'in_progress', new Date().toISOString());
    }
  }

  res.json({ ok: true });
}

export default router;
