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
  for (const c of CATEGORIES.filter((c) => c.id !== 'mixed' && c.id !== 'uxlaws')) assert.ok(QUOTES[c.id].length >= 20, c.id);
  const all = Object.values(QUOTES).flat();
  assert.equal(new Set(all).size, all.length);
});

import { UX_LAWS } from '../src/data/uxLaws.js';

test('Laws of UX category serves all 30 laws with name and link', () => {
  assert.equal(UX_LAWS.length, 30);
  assert.equal(new Set(UX_LAWS.map((l) => l.url)).size, 30);
  const seen = new Set();
  for (let n = 0; n < 30; n++) {
    const q = quoteFor('2026-09-26', 'uxlaws', n);
    assert.ok(q.title && q.url.startsWith('https://lawsofux.com/') && q.author === 'Laws of UX');
    seen.add(q.title);
  }
  assert.equal(seen.size, 30);
});
