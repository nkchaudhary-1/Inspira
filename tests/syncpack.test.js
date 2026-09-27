import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickForSync, toChunks, toItems, fromItems, staleKeys, CHUNK_LIMIT } from '../src/core/syncPack.js';

const DAY = 864e5;
const now = Date.UTC(2026, 8, 27);
const task = (i, extra = {}) => [`t${i}`, { id: `t${i}`, title: `Task ${i} ${'x'.repeat(200)}`, updatedAt: now - i * 1000, ...extra }];

test('prefs, projects and open tasks always come first; old done items stay local', () => {
  const data = {
    prefs: { theme: 'dark', updatedAt: now },
    projects: { p1: { id: 'p1', name: 'Work', updatedAt: 1 } },
    tasks: Object.fromEntries([task(1), task(2, { done: true, updatedAt: now - 90 * DAY }), task(3, { done: true })]),
    notes: { n1: { id: 'n1', title: 'Old', updatedAt: now - 120 * DAY }, n2: { id: 'n2', title: 'New', updatedAt: now } },
  };
  const { data: out, skipped } = pickForSync(data, { now });
  assert.deepEqual(Object.keys(out.tasks).sort(), ['t1', 't3']);
  assert.deepEqual(Object.keys(out.notes), ['n2']);
  assert.equal(out.projects.p1.name, 'Work');
  assert.equal(out.prefs.theme, 'dark');
  assert.equal(skipped, 0);
});

test('never exceeds the budget and never truncates a record', () => {
  const tasks = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => task(i)));
  const { data: out, bytes, skipped } = pickForSync({ prefs: {}, projects: {}, tasks, notes: {} }, { now, budget: 20_000 });
  assert.ok(bytes <= 20_000);
  assert.ok(skipped > 0);
  for (const [id, rec] of Object.entries(out.tasks)) assert.equal(rec.title, tasks[id].title);
  // Newest first.
  assert.ok(out.tasks.t0 && !out.tasks.t1999);
});

test('chunks stay under the per-item quota even when full of quotes', () => {
  const json = JSON.stringify({ s: '"\\'.repeat(20000) });
  const chunks = toChunks(json);
  assert.equal(chunks.join(''), json);
  for (const c of chunks) assert.ok(JSON.stringify(c).length <= CHUNK_LIMIT);
});

test('items round-trip, and mixed writes are ignored until complete', () => {
  const payload = { tasks: { a: { title: 'x'.repeat(30000) } }, savedAt: 5 };
  const one = toItems(payload, 'r1');
  assert.deepEqual(fromItems(one), payload);
  const two = toItems({ ...payload, savedAt: 6 }, 'r2');
  const mixed = { ...one, 'inspira.meta': two['inspira.meta'], 'inspira.c0': two['inspira.c0'] };
  assert.equal(fromItems(mixed), null);
  assert.deepEqual(staleKeys({ ...one, 'inspira.c9': {} }, Object.keys(one).length - 1), ['inspira.c9']);
});
