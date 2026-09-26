import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteFor, QUOTES, CATEGORIES } from '../src/data/quotes.js';

test('daily quote is stable for a date and category', () => {
  assert.deepEqual(quoteFor('2026-09-26', 'calm'), quoteFor('2026-09-26', 'calm'));
  assert.equal(quoteFor('2026-09-26', 'calm').category, 'calm');
});

test('"another one" moves to a different quote', () => {
  assert.notEqual(quoteFor('2026-09-26', 'focus', 0).text, quoteFor('2026-09-26', 'focus', 1).text);
});

test('every category has quotes and no duplicates', () => {
  for (const c of CATEGORIES.filter((c) => c.id !== 'mixed')) assert.ok(QUOTES[c.id].length >= 20, c.id);
  const all = Object.values(QUOTES).flat();
  assert.equal(new Set(all).size, all.length);
});
