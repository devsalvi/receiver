import { google } from 'googleapis';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '../../data/google-token.json');

function getAuthClient() {
  if (!existsSync(TOKEN_PATH)) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);

  // Auto-refresh token
  oauth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oauth2Client;
}

export async function createGoogleCalendarEvent({ summary, start, end, description }) {
  const auth = getAuthClient();
  if (!auth) {
    console.log('Google Calendar not connected — skipping sync');
    return null;
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
    }
  });

  return event.data.id;
}

export async function deleteGoogleCalendarEvent(eventId) {
  const auth = getAuthClient();
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  await calendar.events.delete({ calendarId, eventId });
}

export async function getCalendarEvents(timeMin, timeMax) {
  const auth = getAuthClient();
  if (!auth) return [];

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  return response.data.items || [];
}
