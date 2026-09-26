// Settings sheet: account + sync, appearance, inspiration, weather, focus, data.

import * as store from '../core/store.js';
import { CATEGORIES } from '../data/quotes.js';
import { authAvailability, signIn, signOut, connectCalendar, disconnectCalendar } from '../services/auth.js';
import { syncNow, syncLabel } from '../services/sync.js';
import { refreshCalendar, clearCalendar } from '../services/calendar.js';
import { h, icon, reactive } from './dom.js';
import { openSheet, toast } from './overlay.js';
import { openLocation } from './hero.js';
import { PRESETS, backdrop, setBackdrop, activePreset } from './backdrop.js';

export function openSettings() {
  const body = reactive(h('div', { class: 'settings' }), render);
  openSheet('Settings', body);
}

function render() {
  const p = store.prefs();
  const d = store.getDevice();
  return [account(d), themeSection(p), appearance(p), inspiration(p), weatherSection(d, p), focusSection(p), dataSection()];
}

function section(title, ...children) {
  return h('section', { class: 'settings__section' }, h('h3', { class: 'settings__title' }, title), ...children);
}

function row(label, control, hint) {
  return h(
    'div',
    { class: 'settings__row' },
    h('div', null, h('div', { class: 'settings__label' }, label), hint && h('div', { class: 'fineprint' }, hint)),
    control,
  );
}

function segmented(options, value, onChange, label) {
  return h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    options.map(([v, text]) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(v === value),
          class: ['segmented__opt', v === value && 'is-active'],
          onClick: () => onChange(v),
        },
        text,
      ),
    ),
  );
}

function toggle(value, onChange, label) {
  return h(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': String(value),
      'aria-label': label,
      class: ['switch', value && 'is-on'],
      onClick: () => onChange(!value),
    },
    h('span'),
  );
}

async function guarded(fn, failMsg) {
  try {
    await fn();
  } catch (err) {
    console.warn('[inspira]', err);
    toast(failMsg);
  }
}

function account(d) {
  const avail = authAvailability();
  if (!d.account) {
    return section(
      'Account',
      h(
        'p',
        { class: 'settings__lead' },
        'Sign in to sync tasks, notes, projects and preferences across your Chrome browsers. Your data is stored in a private app folder in your Google Drive.',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'google-btn',
          disabled: !avail.ok,
          onClick: () => guarded(async () => (await signIn(), syncNow()), 'Sign-in didn’t complete'),
        },
        googleMark(),
        'Continue with Google',
      ),
      !avail.ok && h('p', { class: 'fineprint' }, avail.reason),
      h('p', { class: 'fineprint' }, 'Everything works without an account — it just stays on this device.'),
    );
  }
  return section(
    'Account',
    h(
      'div',
      { class: 'account' },
      d.account.picture
        ? h('img', { class: 'account__avatar', src: d.account.picture, alt: '', referrerpolicy: 'no-referrer' })
        : h('span', { class: 'account__avatar' }),
      h('div', null, h('div', { class: 'settings__label' }, d.account.name || d.account.email), h('div', { class: 'fineprint' }, d.account.email)),
    ),
    row('Sync', h('button', { type: 'button', class: 'text-btn', onClick: () => syncNow() }, icon('sync', 14), ' Sync now'), syncLabel()),
    row(
      'Google Calendar',
      d.calendarConnected
        ? h('button', { type: 'button', class: 'text-btn', onClick: () => (disconnectCalendar(), clearCalendar()) }, 'Disconnect')
        : h(
            'button',
            {
              type: 'button',
              class: 'text-btn text-btn--strong',
              onClick: () => guarded(async () => (await connectCalendar(), refreshCalendar()), 'Calendar wasn’t connected'),
            },
            'Connect',
          ),
      d.calendarConnected ? 'Showing events from your selected calendars (read-only).' : 'Read-only. Events appear next to your tasks.',
    ),
    h('button', { type: 'button', class: 'text-btn text-btn--danger', onClick: () => guarded(signOut, 'Couldn’t sign out') }, 'Sign out'),
  );
}

/** Range slider with a live value readout. */
function slider({ label, value, min, max, step, format, onChange }) {
  const out = h('output', { class: 'slider__value' }, format(value));
  const input = h('input', {
    type: 'range',
    class: 'slider__input',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    'aria-label': label,
    onInput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format(v);
      onChange(v);
    },
  });
  return h('div', { class: 'slider' }, h('span', { class: 'slider__label' }, label), input, out);
}

const pct = (v) => `${Math.round(v * 100)}%`;

function themeSection(p) {
  const b = backdrop();
  const current = activePreset();
  return section(
    'Theme',
    row(
      'Mode',
      segmented(
        [
          ['system', 'Auto'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ],
        p.theme,
        (v) => store.setPrefs({ theme: v }),
        'Colour mode',
      ),
    ),
    h(
      'div',
      { class: 'presets', role: 'radiogroup', 'aria-label': 'Theme presets' },
      PRESETS.map((preset) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(current === preset.id),
            class: ['preset', current === preset.id && 'is-active'],
            onClick: () => setBackdrop(preset.value),
          },
          h('span', { class: `preset__swatch preset__swatch--${preset.id}`, 'aria-hidden': 'true' }),
          h('span', { class: 'preset__label' }, preset.label),
        ),
      ),
    ),
    !current && h('p', { class: 'fineprint' }, 'Custom theme — pick a preset to reset.'),

    h('h4', { class: 'settings__sub' }, 'Texture'),
    segmented(
      [
        ['none', 'None'],
        ['grain', 'Grain'],
        ['paper', 'Paper'],
        ['static', 'Static'],
      ],
      b.texture,
      (v) => setBackdrop({ texture: v }),
      'Texture',
    ),
    b.texture !== 'none' &&
      slider({ label: 'Amount', value: b.textureAmount, min: 0.05, max: 1, step: 0.05, format: pct, onChange: (v) => setBackdrop({ textureAmount: v }) }),

    h('h4', { class: 'settings__sub' }, 'Grid'),
    segmented(
      [
        ['none', 'None'],
        ['dots', 'Dots'],
        ['lines', 'Lines'],
        ['blueprint', 'Blueprint'],
      ],
      b.grid,
      (v) => setBackdrop({ grid: v }),
      'Grid',
    ),
    b.grid !== 'none' && [
      slider({ label: 'Size', value: b.gridSize, min: 12, max: 96, step: 4, format: (v) => `${v}px`, onChange: (v) => setBackdrop({ gridSize: v }) }),
      slider({ label: 'Opacity', value: b.gridOpacity, min: 0.1, max: 1, step: 0.05, format: pct, onChange: (v) => setBackdrop({ gridOpacity: v }) }),
    ],

    h('h4', { class: 'settings__sub' }, 'Shader'),
    segmented(
      [
        ['none', 'None'],
        ['aurora', 'Aurora'],
        ['mesh', 'Mesh'],
        ['waves', 'Waves'],
      ],
      b.shader,
      (v) => setBackdrop({ shader: v }),
      'Shader',
    ),
    b.shader !== 'none' && [
      slider({ label: 'Intensity', value: b.shaderIntensity, min: 0.1, max: 1, step: 0.05, format: pct, onChange: (v) => setBackdrop({ shaderIntensity: v }) }),
      slider({
        label: 'Speed',
        value: b.shaderSpeed,
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => (v === 0 ? 'Still' : pct(v)),
        onChange: (v) => setBackdrop({ shaderSpeed: v }),
      }),
      h('p', { class: 'fineprint' }, 'Animated shaders pause when the tab is hidden and stay still if your system asks for reduced motion.'),
    ],
  );
}

function appearance(p) {
  return section(
    'Appearance',
    row(
      'Clock',
      segmented(
        [
          [false, '12-hour'],
          [true, '24-hour'],
        ],
        p.clock24,
        (v) => store.setPrefs({ clock24: v }),
        'Clock format',
      ),
    ),
    row(
      'Show seconds',
      toggle(p.showSeconds, (v) => store.setPrefs({ showSeconds: v }), 'Show seconds'),
    ),
    row(
      'Quote beneath the clock',
      toggle(p.showQuoteOnClock, (v) => store.setPrefs({ showQuoteOnClock: v }), 'Quote beneath the clock'),
    ),
    row(
      'Week starts on',
      segmented(
        [
          [1, 'Mon'],
          [0, 'Sun'],
        ],
        p.weekStart,
        (v) => store.setPrefs({ weekStart: v }),
        'Week start',
      ),
    ),
    row(
      'Your name',
      h('input', {
        class: 'field__input settings__input',
        value: p.name,
        placeholder: 'For the greeting',
        maxlength: '40',
        onChange: (e) => store.setPrefs({ name: e.target.value.trim() }),
      }),
    ),
  );
}

function inspiration(p) {
  return section(
    'Daily inspiration',
    h(
      'div',
      { class: 'chips' },
      CATEGORIES.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: ['chip', c.id === p.quoteCategory && 'is-active'],
            'aria-pressed': String(c.id === p.quoteCategory),
            onClick: () => (store.setPrefs({ quoteCategory: c.id }), store.setDevice({ quoteShift: { date: null, n: 0 } })),
          },
          c.label,
        ),
      ),
    ),
  );
}

function weatherSection(d, p) {
  return section(
    'Weather',
    row(
      'Location',
      h('button', { type: 'button', class: 'text-btn', onClick: (e) => openLocation(e.currentTarget) }, d.location ? d.location.name : 'Set location'),
      'Forecast by Open-Meteo.',
    ),
    row(
      'Units',
      segmented(
        [
          ['c', '°C'],
          ['f', '°F'],
        ],
        p.units,
        (v) => store.setPrefs({ units: v }),
        'Units',
      ),
    ),
  );
}

function focusSection(p) {
  const minutes = (key, options, label) =>
    segmented(
      options.map((v) => [v, String(v)]),
      p[key],
      (v) => store.setPrefs({ [key]: v }),
      label,
    );
  return section(
    'Focus timer',
    row('Focus', minutes('focusMinutes', [15, 25, 45, 60], 'Focus minutes'), 'Minutes'),
    row('Short break', minutes('shortBreakMinutes', [3, 5, 10], 'Short break minutes'), 'Minutes'),
    row('Long break', minutes('longBreakMinutes', [10, 15, 20, 30], 'Long break minutes'), 'After every 4th focus session'),
  );
}

function dataSection() {
  const file = h('input', { type: 'file', accept: 'application/json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!json || typeof json !== 'object' || !('tasks' in json || 'notes' in json)) throw new Error('bad file');
      store.applyRemote(json);
      toast('Imported. Existing items were merged, not replaced.');
    } catch {
      toast('That file doesn’t look like an Inspira export');
    }
    file.value = '';
  });
  return section(
    'Your data',
    h(
      'div',
      { class: 'settings__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'ghost-btn',
          onClick: () => {
            const blob = new Blob([JSON.stringify({ ...store.snapshot(), exportedAt: new Date().toISOString(), app: 'inspira', schema: 2 }, null, 2)], {
              type: 'application/json',
            });
            const a = h('a', { href: URL.createObjectURL(blob), download: `inspira-${new Date().toISOString().slice(0, 10)}.json` });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
        },
        'Export JSON',
      ),
      h('button', { type: 'button', class: 'ghost-btn', onClick: () => file.click() }, 'Import'),
      file,
    ),
    h('p', { class: 'fineprint' }, 'Press ? anywhere for keyboard shortcuts.'),
  );
}

function googleMark() {
  const svg = h('svg', { viewBox: '0 0 18 18', width: 18, height: 18, 'aria-hidden': 'true' });
  const paths = [
    ['#4285F4', 'M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z'],
    ['#34A853', 'M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.33A9 9 0 0 0 9 18z'],
    ['#FBBC05', 'M3.96 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3-2.33z'],
    ['#EA4335', 'M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.67 5.16 6.66 3.58 9 3.58z'],
  ];
  for (const [fill, d] of paths) svg.append(h('path', { fill, d }));
  return svg;
}
