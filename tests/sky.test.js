import { test } from 'node:test';
import assert from 'node:assert/strict';

// backdrop.js touches <html> at import; a minimal stand-in is enough here.
globalThis.document ??= { documentElement: { dataset: {}, style: { setProperty() {} } }, querySelector: () => null };
globalThis.window ??= { matchMedia: () => ({ matches: false }), addEventListener() {} };
const { skyPhaseAt } = await import('../src/ui/backdrop.js');

test('sky phases follow the reference time slots and cover every hour', () => {
  const at = (h) => skyPhaseAt(h);
  assert.equal(at(16), 'evening');
  assert.equal(at(18), 'evening');
  assert.equal(at(19), 'night');
  assert.equal(at(21), 'night');
  assert.equal(at(22), 'late');
  assert.equal(at(0), 'late'); // 10 PM – 1 AM crosses midnight
  assert.equal(at(1), 'deep');
  assert.equal(at(3), 'deep');
  assert.equal(at(4), 'dawn');
  assert.equal(at(8), 'day');
  for (let h = 0; h < 24; h++) assert.ok(at(h));
});
