// Reads a calendar export (.ics) into plain events. Calendars (Apple,
// Google, Outlook) all export this format; booking confirmations also
// arrive as .ics attachments.
export interface CalendarEvent {
  uid: string;
  summary: string;
  start: string;       // YYYY-MM-DD
  end: string | null;  // YYYY-MM-DD, null when the event has no end
  location: string;
  description: string;
}

// Lines longer than 75 characters are folded onto the next line, which
// starts with a space or tab; join them back.
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

const unescapeText = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// 20261003, 20261003T100000Z, or 20261003T100000 -> 2026-10-03
function toISODate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseIcs(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) { current = {}; continue; }
    if (line.startsWith('END:VEVENT')) {
      if (current) {
        const start = current.DTSTART ? toISODate(current.DTSTART) : null;
        if (start) {
          let end = current.DTEND ? toISODate(current.DTEND) : null;
          // An all-day event's DTEND is the day after it finishes.
          if (end && /^\d{8}$/.test((current.DTEND ?? '').trim()) && end > start) end = shiftDay(end, -1);
          events.push({
            uid: current.UID ?? `${start}-${current.SUMMARY ?? ''}`,
            summary: unescapeText(current.SUMMARY ?? ''),
            start, end,
            location: unescapeText(current.LOCATION ?? ''),
            description: unescapeText(current.DESCRIPTION ?? ''),
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    // "DTSTART;TZID=Europe/London:2026..." -> property name before any parameters
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    if (!(name in current)) current[name] = line.slice(colon + 1);
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The event as text the booking extractor can read like a confirmation.
export function eventToText(e: CalendarEvent): string {
  return [
    `Calendar event: ${e.summary}`,
    `Starts: ${e.start}`,
    e.end ? `Ends: ${e.end}` : '',
    e.location ? `Location: ${e.location}` : '',
    e.description ? `Details:\n${e.description}` : '',
  ].filter(Boolean).join('\n');
}
