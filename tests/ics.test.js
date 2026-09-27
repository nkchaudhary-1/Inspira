import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseICS, expandEvents, wallToMs } from '../src/core/ics.js';

const feed = (body) => `BEGIN:VCALENDAR\r\nX-WR-CALNAME:Work\r\n${body}\r\nEND:VCALENDAR\r\n`;
const ev = (lines) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`;
const range = (a, b) => [Date.UTC(...a), Date.UTC(...b)];

test('single, all-day and folded events', () => {
  const cal = parseICS(
    feed(
      [
        ev(['UID:1', 'SUMMARY:Standup with a very long', '  title', 'DTSTART:20260928T033000Z', 'DTEND:20260928T040000Z', 'LOCATION:Room 1\\, 2F']),
        ev(['UID:2', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20260929', 'DTEND;VALUE=DATE:20260930']),
      ].join('\r\n'),
    ),
  );
  assert.equal(cal.name, 'Work');
  const out = expandEvents(cal, ...range([2026, 8, 27], [2026, 9, 1]));
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'Standup with a very long title');
  assert.equal(out[0].location, 'Room 1, 2F');
  assert.equal(out[0].start, Date.UTC(2026, 8, 28, 3, 30));
  assert.equal(out[1].allDay, true);
  assert.equal(out[1].start, new Date(2026, 8, 29).getTime());
});

test('TZID times convert correctly across a DST change', () => {
  const cal = parseICS(
    feed(
      ev([
        'UID:3',
        'SUMMARY:NY call',
        'DTSTART;TZID=America/New_York:20261102T090000',
        'DURATION:PT30M',
        'RRULE:FREQ=DAILY;COUNT=3',
        'DTSTART;TZID=America/New_York:20261030T090000',
      ]),
    ),
  );
  const out = expandEvents(cal, ...range([2026, 9, 29], [2026, 10, 5]));
  // Oct 30 & 31 are EDT (UTC-4); Nov 1 is EST (UTC-5) — still 9:00 local.
  assert.deepEqual(
    out.map((e) => new Date(e.start).toISOString()),
    ['2026-10-30T13:00:00.000Z', '2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z'],
  );
  assert.equal(out[0].end - out[0].start, 30 * 60 * 1000);
});

test('weekly BYDAY with EXDATE and a moved occurrence', () => {
  const cal = parseICS(
    feed(
      [
        ev([
          'UID:w',
          'SUMMARY:Gym',
          'DTSTART:20260928T120000Z',
          'DTEND:20260928T130000Z',
          'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261014T235959Z',
          'EXDATE:20260930T120000Z',
        ]),
        ev(['UID:w', 'SUMMARY:Gym (moved)', 'RECURRENCE-ID:20261005T120000Z', 'DTSTART:20261005T150000Z', 'DTEND:20261005T160000Z']),
      ].join('\r\n'),
    ),
  );
  const out = expandEvents(cal, ...range([2026, 8, 1], [2026, 11, 1]));
  assert.deepEqual(
    out.map((e) => `${new Date(e.start).toISOString().slice(5, 16)} ${e.title}`),
    ['09-28T12:00 Gym', '10-05T15:00 Gym (moved)', '10-07T12:00 Gym', '10-12T12:00 Gym', '10-14T12:00 Gym'],
  );
});

test('monthly nth weekday, last weekday and cancelled events', () => {
  const cal = parseICS(
    feed(
      [
        ev(['UID:m', 'SUMMARY:Review', 'DTSTART:20260908T100000Z', 'DTEND:20260908T110000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3']),
        ev(['UID:l', 'SUMMARY:Payday', 'DTSTART;VALUE=DATE:20260930', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=2']),
        ev(['UID:c', 'SUMMARY:Gone', 'STATUS:CANCELLED', 'DTSTART:20261001T100000Z']),
      ].join('\r\n'),
    ),
  );
  const out = expandEvents(cal, ...range([2026, 8, 1], [2027, 0, 1]));
  const titles = out.map((e) => `${e.title} ${new Date(e.start + 12 * 36e5).toISOString().slice(5, 10)}`);
  assert.deepEqual(titles, ['Review 09-08', 'Payday 09-30', 'Review 10-13', 'Payday 10-31', 'Review 11-10']);
});

test('invalid time zones fall back to local wall time', () => {
  const cal = parseICS(
    feed(ev(['UID:x', 'SUMMARY:Outlook', 'DTSTART;TZID=India Standard Time:20260928T090000', 'DTEND;TZID=India Standard Time:20260928T100000'])),
  );
  const [e] = expandEvents(cal, ...range([2026, 8, 27], [2026, 8, 30]));
  assert.equal(e.start, wallToMs({ y: 2026, mo: 8, d: 28, h: 9 }, 'local'));
});
