import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanData, safeUrl, safeColor } from '../src/core/sanitize.js';
import { mergeData } from '../src/core/merge.js';

test('links: only http(s) survive', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<b>x</b>'), '');
  assert.equal(safeUrl('chrome://settings'), '');
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeUrl(42), '');
});

test('colours: only hex values reach a style', () => {
  assert.equal(safeColor('#8a8fc2'), '#8a8fc2');
  assert.equal(safeColor('url(https://tracker.example/p.gif)'), null);
  assert.equal(safeColor('red; background: url(x)'), null);
});

test('imported data is rebuilt with known fields and types only', () => {
  const evil = JSON.parse(`{
    "tasks": {
      "__proto__": { "title": "polluted" },
      "ok1": { "title": ${JSON.stringify('x'.repeat(2000))}, "date": "2026-09-27", "priority": 9, "done": "yes", "onclick": "alert(1)" },
      "bad id!": { "title": "dropped" },
      "arr": [1, 2]
    },
    "projects": { "p1": { "name": "Work", "color": "url(https://t.example)" } },
    "prefs": { "theme": "neon", "name": 42, "clock24": true, "backdrop": { "light": "custom", "custom": "#abc", "x-y": 1, "big": ${JSON.stringify('y'.repeat(100))} } }
  }`);
  const clean = cleanData(evil);
  assert.deepEqual(Object.keys(clean.tasks), ['ok1']);
  const t = clean.tasks.ok1;
  assert.equal(t.title.length, 500);
  assert.equal(t.priority, 0);
  assert.equal(t.done, false);
  assert.equal('onclick' in t, false);
  assert.equal(clean.projects.p1.color, '#8a8fc2');
  assert.deepEqual(clean.prefs, { clock24: true, backdrop: { light: 'custom', custom: '#abc' } });
  assert.equal({}.title, undefined, 'no prototype pollution');
});

test('merge never lets a remote record through uncleaned', () => {
  const local = { tasks: {}, notes: {}, projects: {}, prefs: { updatedAt: 1 } };
  const out = mergeData(local, { tasks: { a: { title: 'Hi', updatedAt: 5, date: '<img>' } } });
  assert.equal(out.tasks.a.title, 'Hi');
  assert.equal(out.tasks.a.date, null);
});
