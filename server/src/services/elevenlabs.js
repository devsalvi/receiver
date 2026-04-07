const API_BASE = 'https://api.elevenlabs.io/v1';
const API_KEY = process.env.ELEVENLABS_API_KEY;

async function elevenLabsRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Create a conversational AI agent for a store
export async function createAgent(store, services, barbers, webhookBaseUrl) {
  const serviceList = services.map(s =>
    `- ${s.name} (${s.duration_minutes} min, $${(s.price_cents / 100).toFixed(2)})`
  ).join('\n');

  const barberList = barbers
    .filter(b => !b.name.includes('Any Available'))
    .map(b => `- ${b.name}`)
    .join('\n');

  const greeting = (store.greeting_message || "Hi, this is {shop_name}. I'm an AI assistant — I can book your appointment.")
    .replace('{shop_name}', store.name);

  const systemPrompt = `You are a friendly, professional AI receptionist for ${store.name}, a barber shop.

Your job is to help callers book appointments. Be conversational but efficient — aim to complete bookings in under 2 minutes.

AVAILABLE SERVICES:
${serviceList}

${barberList ? `BARBERS:\n${barberList}\n` : ''}

BOOKING FLOW:
1. Greet the caller warmly
2. Ask what service they'd like
3. Ask if they have a preferred barber (if multiple barbers available)
4. Ask for their preferred date and time
5. Check availability using the check_availability tool
6. Offer 2-3 available slots if their preferred time isn't available
7. Once they pick a slot, ask for their first name and confirm their phone number
8. Read back the full booking summary: service, barber, date, time, name
9. Ask them to confirm
10. Book the appointment using the book_appointment tool
11. Let them know they'll receive an SMS confirmation

IMPORTANT RULES:
- Only book within business hours
- Always confirm the full booking details before finalizing
- If the caller asks about something you can't help with, politely let them know and suggest they call back during business hours
- Be natural and conversational, not robotic
- If the caller seems confused or frustrated, offer to help step by step`;

  const agent = await elevenLabsRequest('/convai/agents/create', {
    method: 'POST',
    body: JSON.stringify({
      name: `Receiver - ${store.name}`,
      conversation_config: {
        agent: {
          first_message: greeting,
          language: 'en',
          prompt: {
            prompt: systemPrompt,
            llm: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: -1,
            tools: [
              {
                type: 'webhook',
                name: 'check_availability',
                description: 'Check available appointment slots for a given date and optional barber. Call this when the customer wants to know what times are available.',
                response_timeout_secs: 15,
                api_schema: {
                  url: `${webhookBaseUrl}/api/elevenlabs/check-availability`,
                  method: 'POST',
                  content_type: 'application/json',
                  request_body_schema: {
                    type: 'object',
                    description: 'Availability check parameters',
                    properties: {
                      store_id: { type: 'string', description: 'Store ID', enum: [store.id] },
                      date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                      barber_name: { type: 'string', description: 'Optional barber name preference' },
                    },
                  },
                },
              },
              {
                type: 'webhook',
                name: 'book_appointment',
                description: 'Book an appointment after the customer has confirmed all details. Only call this after reading back the full summary and getting confirmation.',
                response_timeout_secs: 20,
                api_schema: {
                  url: `${webhookBaseUrl}/api/elevenlabs/book-appointment`,
                  method: 'POST',
                  content_type: 'application/json',
                  request_body_schema: {
                    type: 'object',
                    description: 'Appointment booking details',
                    properties: {
                      store_id: { type: 'string', description: 'Store ID', enum: [store.id] },
                      customer_name: { type: 'string', description: 'Customer first name' },
                      customer_phone: { type: 'string', description: 'Customer phone number' },
                      service_name: { type: 'string', description: 'Name of the service' },
                      barber_name: { type: 'string', description: 'Barber name or "any"' },
                      date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                      time: { type: 'string', description: 'Time in HH:MM format (24h)' },
                    },
                  },
                },
              },
            ],
          },
        },
        tts: {
          model_id: 'eleven_flash_v2',
          voice_id: 'cjVigY5qzO86Huf0OWal', // Josh voice
          stability: 0.5,
          similarity_boost: 0.8,
          speed: 1,
        },
        conversation: {
          max_duration_seconds: 300,
        },
        turn: {
          turn_timeout: 7,
        },
      },
    }),
  });

  return agent;
}

// Get agent details
export async function getAgent(agentId) {
  return elevenLabsRequest(`/convai/agents/${agentId}`);
}

// Update agent
export async function updateAgent(agentId, config) {
  return elevenLabsRequest(`/convai/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

// Delete agent
export async function deleteAgent(agentId) {
  return elevenLabsRequest(`/convai/agents/${agentId}`, { method: 'DELETE' });
}

// Import a phone number and assign to agent
export async function assignPhoneNumber(phoneNumber, agentId, twilioSid, twilioToken) {
  // Import the number
  const imported = await elevenLabsRequest('/convai/phone-numbers', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: phoneNumber,
      label: 'Receiver Line',
      provider: 'twilio',
      sid: twilioSid,
      token: twilioToken,
    }),
  });

  // Assign agent to the number
  await elevenLabsRequest(`/convai/phone-numbers/${imported.phone_number_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ agent_id: agentId }),
  });

  return imported;
}
