import { describe, expect, test } from 'vitest';
import { eventToText, parseIcs } from './ics';

const ics = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;

describe('parseIcs', () => {
  test('reads title, dates, location and details', () => {
    const [e] = parseIcs(ics(
      'BEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Flight BA880 to Budapest\r\nDTSTART:20261110T073000Z\r\nDTEND:20261110T102000Z\r\nLOCATION:Heathrow T5\r\nDESCRIPTION:Booking ref ABC123\\nSeat 12A\r\nEND:VEVENT',
    ));
    expect(e).toMatchObject({ uid: 'abc', summary: 'Flight BA880 to Budapest', start: '2026-11-10', end: '2026-11-10', location: 'Heathrow T5' });
    expect(e.description).toBe('Booking ref ABC123\nSeat 12A');
  });

  test('an all-day event ends the day before its exclusive DTEND', () => {
    const [e] = parseIcs(ics('BEGIN:VEVENT\r\nSUMMARY:Hotel Gellert\r\nDTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261113\r\nEND:VEVENT'));
    expect(e.start).toBe('2026-11-10');
    expect(e.end).toBe('2026-11-12');
  });

  test('folded lines are rejoined and parameters on the property name are ignored', () => {
    const [e] = parseIcs(ics('BEGIN:VEVENT\r\nSUMMARY;LANGUAGE=en:Very long\r\n  title that wraps\r\nDTSTART;TZID=Europe/London:20261110T090000\r\nEND:VEVENT'));
    expect(e.summary).toBe('Very long title that wraps');
    expect(e.start).toBe('2026-11-10');
  });

  test('escaped commas and semicolons are unescaped; events come back in date order', () => {
    const events = parseIcs(ics(
      'BEGIN:VEVENT\r\nSUMMARY:Later\r\nDTSTART:20270101\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Dinner\\, drinks\; late\r\nDTSTART:20261201\r\nEND:VEVENT',
    ));
    expect(events.map((e) => e.summary)).toEqual(['Dinner, drinks; late', 'Later']);
  });

  test('an event with no usable start date is skipped; garbage gives no events', () => {
    expect(parseIcs(ics('BEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT'))).toEqual([]);
    expect(parseIcs('not a calendar')).toEqual([]);
  });
});

describe('eventToText', () => {
  test('lays the event out like a short confirmation', () => {
    expect(eventToText({ uid: 'u', summary: 'Hotel Gellert', start: '2026-11-10', end: '2026-11-12', location: 'Budapest', description: 'Ref 1' }))
      .toBe('Calendar event: Hotel Gellert\nStarts: 2026-11-10\nEnds: 2026-11-12\nLocation: Budapest\nDetails:\nRef 1');
  });
});
