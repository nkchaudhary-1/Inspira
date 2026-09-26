import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, mergeCollection, purgeTombstones, fingerprint, TOMBSTONE_TTL } from '../src/core/merge.js';

const t = (id, updatedAt, extra = {}) => ({ id, updatedAt, ...extra });

test('newer record wins in either direction', () => {
  const local = { a: t('a', 5, { title: 'local' }), b: t('b', 1, { title: 'old' }) };
  const remote = { a: t('a', 3, { title: 'remote' }), b: t('b', 9, { title: 'new' }), c: t('c', 2) };
  const out = mergeCollection(local, remote);
  assert.equal(out.a.title, 'local');
  assert.equal(out.b.title, 'new');
  assert.ok(out.c);
});

test('deletions propagate as tombstones and expire', () => {
  const now = 100 * TOMBSTONE_TTL;
  const merged = mergeData({ tasks: { a: t('a', now - 10) } }, { tasks: { a: t('a', now - 5, { deleted: true }) } }, now);
  assert.equal(merged.tasks.a.deleted, true);
  const purged = purgeTombstones({ a: t('a', now - TOMBSTONE_TTL - 1, { deleted: true }) }, now);
  assert.deepEqual(purged, {});
});

test('prefs merge as a whole by updatedAt', () => {
  const merged = mergeData({ prefs: { theme: 'dark', updatedAt: 10 } }, { prefs: { theme: 'light', updatedAt: 20 } });
  assert.equal(merged.prefs.theme, 'light');
});

test('fingerprint detects changes', () => {
  const a = { tasks: { x: t('x', 1) }, notes: {}, projects: {}, prefs: { updatedAt: 0 } };
  const b = { ...a, tasks: { x: t('x', 2) } };
  assert.notEqual(fingerprint(a), fingerprint(b));
  assert.equal(fingerprint(a), fingerprint({ ...a }));
});
