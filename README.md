# Receiver - AI Voice Booking Agent

AI-powered voice receptionist that handles 100% of inbound appointment calls for barber shops. Books appointments via voice, checks real-time calendar availability, sends SMS confirmations and reminders.

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your Twilio, Google, and Vapi credentials

# Initialize database
cd server && npm run db:init

# Run in development
cd server && npm run dev    # API on :3001
cd client && npm run dev    # UI on :5173
```

## Architecture

```
receiver/
├── server/              # Express API
│   ├── src/
│   │   ├── db/          # SQLite schema + init
│   │   ├── routes/      # REST API + Vapi webhook
│   │   └── services/    # Calendar, SMS, Reminders
│   └── data/            # SQLite DB + Google token
├── client/              # React + Vite + Tailwind
│   └── src/
│       └── pages/       # Dashboard, Appointments, Calls, Services, Hours, Settings
```

## Integrations

- **Vapi** — Voice AI agent (webhook at `/api/vapi/webhook`)
- **Twilio** — SMS confirmations & reminders
- **Google Calendar** — Real-time availability + booking sync

## Call Flow

1. Inbound call → Vapi routes to webhook
2. Agent greets, asks for service/barber/time
3. Checks availability via function call
4. Books slot, writes to DB + Google Calendar
5. SMS confirmation sent within 30 seconds
6. Reminders at T-24h and T-2h
