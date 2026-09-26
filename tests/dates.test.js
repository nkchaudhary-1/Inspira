import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, monthMatrix, clockParts, formatTime, daypart, isValidKey, relativeLabel, formatDuration } from '../src/core/dates.js';

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('addMonths clamps to the last day of shorter months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-03-15', -3), '2025-12-15');
});

test('monthMatrix starts on the configured weekday', () => {
  const mon = monthMatrix(2026, 8, 1); // September 2026, starts Tuesday
  assert.equal(mon.length, 6);
  assert.equal(mon[0][0], '2026-08-31');
  assert.equal(mon[0][1], '2026-09-01');
  const sun = monthMatrix(2026, 8, 0);
  assert.equal(sun[0][0], '2026-08-30');
});

test('clock formats 12h and 24h', () => {
  const d = new Date(2026, 8, 26, 17, 42, 9);
  assert.deepEqual(clockParts(d, false, false), { time: '05:42', meridiem: 'PM' });
  assert.deepEqual(clockParts(d, true, true), { time: '17:42:09', meridiem: '' });
  assert.equal(formatTime('00:05', false), '12:05 AM');
  assert.equal(formatTime('18:00', false), '6:00 PM');
});

test('daypart buckets', () => {
  assert.equal(daypart(6), 'dawn');
  assert.equal(daypart(9), 'morning');
  assert.equal(daypart(14), 'afternoon');
  assert.equal(daypart(19), 'evening');
  assert.equal(daypart(23), 'night');
  assert.equal(daypart(3), 'night');
});

test('misc helpers', () => {
  assert.ok(isValidKey('2026-09-26'));
  assert.ok(!isValidKey('2026-02-30'));
  assert.equal(relativeLabel('2026-09-27', '2026-09-26'), 'Tomorrow');
  assert.equal(relativeLabel('2026-09-20', '2026-09-26'), null);
  assert.equal(formatDuration(25 * 60000), '25:00');
  assert.equal(formatDuration(61000), '01:01');
});
