import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, parseTime } from '../src/core/quickadd.js';

test('plain text is untouched', () => {
  assert.deepEqual(parseQuickAdd('Finish portfolio homepage'), { title: 'Finish portfolio homepage', priority: 0, time: null, project: null });
});

test('extracts project, priority and time tokens', () => {
  assert.deepEqual(parseQuickAdd('Review designs #work !! @4pm'), { title: 'Review designs', priority: 2, time: '16:00', project: 'work' });
  assert.deepEqual(parseQuickAdd('!3 Call mom @18:30'), { title: 'Call mom', priority: 3, time: '18:30', project: null });
});

test('ignores tokens that only look similar', () => {
  assert.equal(parseQuickAdd('Email ana@studio.com').title, 'Email ana@studio.com');
  assert.equal(parseQuickAdd('Wow! great').title, 'Wow! great');
  assert.equal(parseQuickAdd('C# notes').title, 'C# notes');
});

test('parseTime edge cases', () => {
  assert.equal(parseTime('@12am'), '00:00');
  assert.equal(parseTime('@12pm'), '12:00');
  assert.equal(parseTime('@9:05am'), '09:05');
  assert.equal(parseTime('@25'), null);
  assert.equal(parseTime('@13pm'), null);
});

import { splitTaskLines } from '../src/core/quickadd.js';

test('pasted lists split into task lines', () => {
  assert.deepEqual(splitTaskLines('- Buy milk\n• Call mom #home\n\n1. Ship v2 !!\n[ ] Review @4pm\r\nPlain'), [
    'Buy milk',
    'Call mom #home',
    'Ship v2 !!',
    'Review @4pm',
    'Plain',
  ]);
  assert.deepEqual(splitTaskLines('single'), ['single']);
});
