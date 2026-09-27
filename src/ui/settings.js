// Settings sheet, in four tabs so nothing is a long scroll:
//   Appearance — colour mode, background style, fine-tune
//   General    — you, clock, calendar, inspiration, weather
//   Focus      — pomodoro lengths
//   Account    — Google sign-in, sync, calendar, your data
// Each tab is a column of cards; each card holds hairline-separated rows.

import * as store from '../core/store.js';
import { CATEGORIES } from '../data/quotes.js';
import { authAvailability, signIn, signOut, connectCalendar, disconnectCalendar } from '../services/auth.js';
import { syncNow, syncLabel } from '../services/sync.js';
import { refreshCalendar, clearCalendar, normalizeIcsUrl, icsOrigin, testIcsUrl, setIcsUrl, removeIcsUrl } from '../services/calendar.js';
import { chromeSyncAvailable, chromeSyncOn, setChromeSync, chromeSyncLabel } from '../services/chromeSync.js';
import { h, icon, reactive } from './dom.js';
import { openSheet, closeOverlay, toast } from './overlay.js';
import { openLocation } from './hero.js';
import { kitIcon } from './weatherIcons.js';
import { PRESETS, SKY_PHASES, DEFAULT_BACKDROP, backdrop, setBackdrop, activePreset, skyPhaseAt } from './backdrop.js';

const TABS = [
  ['appearance', 'Appearance'],
  ['general', 'General'],
  ['focus', 'Focus'],
  ['account', 'Account'],
];

/** Open Settings, optionally on a tab. Safe to pass straight as a click handler. */
export function openSettings(tab) {
  if (typeof tab === 'string' && TABS.some(([id]) => id === tab)) store.setUI({ settingsTab: tab });
  const body = reactive(h('div', { class: 'settings' }), render);
  openSheet('Settings', body);
}

function render() {
  const p = store.prefs();
  const d = store.getDevice();
  const tab = TABS.some(([id]) => id === store.ui.settingsTab) ? store.ui.settingsTab : 'appearance';
  const panels = {
    appearance: () => [modeCard(p), backgroundCard(), skyCard(), fineTuneCard()],
    general: () => [youCard(p), clockCard(p), inspirationCard(p), weatherCard(d, p)],
    focus: () => [focusCard(p)],
    account: () => [
      syncCard(),
      calendarCard(d),
      (authAvailability().ok || d.account) && accountCard(d),
      dataCard(),
      h('p', { class: 'settings__hint settings__foot' }, 'Press ? anywhere for keyboard shortcuts.'),
    ],
  };
  return [
    h(
      'div',
      { class: 'settings__tabs', role: 'tablist', 'aria-label': 'Settings sections' },
      TABS.map(([id, label]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(id === tab),
            class: ['settings__tab', id === tab && 'is-active'],
            onClick: () => store.setUI({ settingsTab: id }),
          },
          label,
        ),
      ),
    ),
    h('div', { class: 'settings__panel', role: 'tabpanel' }, panels[tab]()),
    h(
      'footer',
      { class: 'settings__footer' },
      tab === 'appearance' &&
        h(
          'button',
          {
            type: 'button',
            class: 'glass-btn',
            onClick: () => {
              store.setPrefs({ theme: 'system', backdrop: { ...DEFAULT_BACKDROP } });
              toast('Appearance reset');
            },
          },
          'Reset appearance',
        ),
      h('button', { type: 'button', class: 'glass-btn glass-btn--primary', onClick: () => closeOverlay() }, 'Done'),
    ),
  ];
}

/** A titled section. Consecutive rows sit together in one inset group. */
function card(title, ...children) {
  const items = [];
  let run = null;
  for (const child of children.flat()) {
    if (!child) continue;
    if (child.classList?.contains('settings__row')) {
      if (!run) items.push((run = h('div', { class: 'settings__group' })));
      run.append(child);
    } else {
      run = null;
      items.push(child);
    }
  }
  return h('section', { class: 'settings__card' }, title && h('h3', { class: 'settings__title' }, title), h('div', { class: 'settings__rows' }, items));
}

function row(label, control, hint, { stack = false } = {}) {
  return h(
    'div',
    { class: ['settings__row', stack && 'settings__row--stack'] },
    h('div', { class: 'settings__text' }, h('div', { class: 'settings__label' }, label), hint && h('div', { class: 'settings__hint' }, hint)),
    control,
  );
}

/** A full-width block inside a card (galleries, chips, sliders). */
const block = (...children) => h('div', { class: 'settings__block' }, ...children);

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

/** Sync through the Chrome profile — no account needed. */
function syncCard() {
  return card(
    'Sync',
    row('Sync with Chrome', chromeSyncAvailable() ? toggle(chromeSyncOn(), setChromeSync, 'Sync with Chrome') : null, chromeSyncLabel()),
    h(
      'p',
      { class: 'settings__hint settings__aside' },
      'Your tasks, notes, projects and settings follow you to any computer where you’re signed in to Chrome with sync on. Open tasks and the last 60 days travel; older items stay on this computer.',
    ),
  );
}

/** Read-only calendar from a private iCal link: Google, Outlook or iCloud. */
function calendarCard(d) {
  if (d.icsUrl) {
    const failed = store.ui.calendarStatus === 'error';
    return card(
      'Calendar',
      row(
        d.icsName || 'Calendar',
        h(
          'div',
          { class: 'settings__actions' },
          h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: () => refreshCalendar() }, icon('refresh', 14), 'Refresh'),
          h(
            'button',
            { type: 'button', class: 'ghost-btn ghost-btn--sm ghost-btn--danger', onClick: () => (removeIcsUrl(), toast('Calendar removed')) },
            'Remove',
          ),
        ),
        failed ? 'Couldn’t reach the link — check it’s still valid' : 'Read-only · refreshes every 15 minutes',
      ),
    );
  }
  const input = h('input', {
    class: 'field__input settings__link',
    type: 'url',
    placeholder: 'Paste your secret iCal link',
    'aria-label': 'Calendar link',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const add = h('button', { type: 'submit', class: 'glass-btn glass-btn--primary settings__add' }, 'Add');
  const connect = async (e) => {
    e.preventDefault();
    const url = normalizeIcsUrl(input.value);
    if (!url) return toast('Paste a Google Calendar, Outlook or iCloud calendar link');
    // Ask for access to just this calendar's host (must happen in the click).
    const granted = typeof chrome !== 'undefined' && chrome.permissions ? await chrome.permissions.request({ origins: [icsOrigin(url)] }) : true;
    if (!granted) return toast('Inspira needs permission to read that calendar');
    add.disabled = true;
    add.textContent = 'Checking…';
    try {
      const name = await testIcsUrl(url);
      setIcsUrl(url, name);
      toast(`Added ${name}`);
    } catch (err) {
      console.warn('[inspira] calendar link', err);
      toast('Couldn’t read that link — use the secret iCal address');
      add.disabled = false;
      add.textContent = 'Add';
    }
  };
  return card(
    'Calendar',
    h('form', { class: 'settings__linkform', onSubmit: connect }, input, add),
    h(
      'details',
      { class: 'settings__howto' },
      h('summary', null, 'Where do I find it?'),
      h(
        'ul',
        null,
        h('li', null, h('strong', null, 'Google Calendar'), ' — Settings → your calendar → “Secret address in iCal format”'),
        h('li', null, h('strong', null, 'Outlook'), ' — Settings → Calendar → Shared calendars → Publish → ICS link'),
        h('li', null, h('strong', null, 'iCloud'), ' — Calendar → Share → Public calendar → copy link'),
      ),
      h('p', null, 'Read-only. The link stays on this computer — anyone with it can see that calendar, so keep it private.'),
    ),
  );
}

function accountCard(d) {
  const avail = authAvailability();
  if (!d.account) {
    return card(
      'Google account',
      block(
        h(
          'p',
          { class: 'settings__hint settings__note' },
          'Sign in to sync tasks, notes, projects and preferences across your Chrome browsers. Stored in a private app folder in your Google Drive.',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'glass-btn google-btn',
            disabled: !avail.ok,
            onClick: () => guarded(async () => (await signIn(), syncNow()), 'Sign-in didn’t complete'),
          },
          googleMark(),
          'Continue with Google',
        ),
        !avail.ok && h('p', { class: 'settings__hint' }, avail.reason),
        h('p', { class: 'settings__hint' }, 'Everything works without an account — it just stays on this device.'),
      ),
    );
  }
  return card(
    'Google account',
    block(
      h(
        'div',
        { class: 'account' },
        d.account.picture
          ? h('img', { class: 'account__avatar', src: d.account.picture, alt: '', referrerpolicy: 'no-referrer' })
          : h('span', { class: 'account__avatar' }),
        h('div', null, h('div', { class: 'settings__label' }, d.account.name || d.account.email), h('div', { class: 'settings__hint' }, d.account.email)),
      ),
    ),
    row('Sync', h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: () => syncNow() }, icon('sync', 14), 'Sync now'), syncLabel()),
    row(
      'Google Calendar',
      d.calendarConnected
        ? h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: () => (disconnectCalendar(), clearCalendar()) }, 'Disconnect')
        : h(
            'button',
            {
              type: 'button',
              class: 'ghost-btn ghost-btn--sm',
              onClick: () => guarded(async () => (await connectCalendar(), refreshCalendar()), 'Calendar wasn’t connected'),
            },
            'Connect',
          ),
      d.calendarConnected ? 'Showing events from your selected calendars (read-only).' : 'Read-only. Events appear next to your tasks.',
    ),
    row(
      'Sign out',
      h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm ghost-btn--danger', onClick: () => guarded(signOut, 'Couldn’t sign out') }, 'Sign out'),
      'Your data stays on this device',
    ),
  );
}

/** A tiny app window: sidebar with dots and lines, content with three cards. */
const windowPreview = () =>
  h(
    'span',
    { class: 'wp' },
    h(
      'span',
      { class: 'wp__side' },
      h('span', { class: 'wp__dots' }, h('i'), h('i'), h('i')),
      h('i', { class: 'wp__line' }),
      h('i', { class: 'wp__line wp__line--short' }),
    ),
    h(
      'span',
      { class: 'wp__main' },
      h('i', { class: 'wp__line' }),
      h('i', { class: 'wp__line wp__line--faint' }),
      h('span', { class: 'wp__cards' }, h('i'), h('i'), h('i')),
    ),
  );

const MODE_OPTIONS = [
  ['system', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

function modeCard(p) {
  return card(
    'Colour mode',
    block(
      h(
        'div',
        { class: 'modes', role: 'radiogroup', 'aria-label': 'Colour mode' },
        MODE_OPTIONS.map(([id, label]) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(p.theme === id),
              class: ['mode-opt', p.theme === id && 'is-active'],
              onClick: () => store.setPrefs({ theme: id }),
            },
            h(
              'span',
              { class: `mode-opt__thumb mode-opt__thumb--${id}`, 'aria-hidden': 'true' },
              windowPreview(),
              p.theme === id && h('span', { class: 'thumb-check' }, icon('check', 12)),
            ),
            h('span', { class: 'mode-opt__label' }, label),
          ),
        ),
      ),
    ),
  );
}

function backgroundCard() {
  const current = activePreset();
  return card(
    'Background',
    block(
      h(
        'div',
        { class: 'presets', role: 'radiogroup', 'aria-label': 'Background style' },
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
            h(
              'span',
              { class: `preset__swatch preset__swatch--${preset.id}`, 'aria-hidden': 'true', dataset: { phase: skyPhaseAt(new Date().getHours()) } },
              // A tiny new tab: the clock and the dock handle.
              h('span', { class: 'preset__time' }, '9:41'),
              h('span', { class: 'preset__dock' }),
              current === preset.id && h('span', { class: 'thumb-check' }, icon('check', 12)),
            ),
            h('span', { class: 'preset__label' }, preset.label),
          ),
        ),
      ),
      !current && h('p', { class: 'settings__hint' }, 'Custom — tweaked below. Pick a style to reset.'),
    ),
  );
}

/** Sky gradients: follow the time of day, or pin one phase. */
function skyCard() {
  const b = backdrop();
  const on = b.light === 'sky';
  const auto = on && b.sky === 'auto';
  const now = skyPhaseAt(new Date().getHours());
  return card(
    'Sky',
    row(
      'Follow the time of day',
      toggle(auto, (v) => setBackdrop({ light: 'sky', sky: v ? 'auto' : now }), 'Follow the time of day'),
      auto
        ? 'The sky changes with the hour'
        : on
          ? `Pinned to ${SKY_PHASES.find((x) => x.id === b.sky)?.label.toLowerCase() || 'one sky'}`
          : 'Uses the sky as your background',
    ),
    block(
      h(
        'div',
        { class: 'sky-opts', role: 'radiogroup', 'aria-label': 'Sky gradient' },
        SKY_PHASES.map((p) => {
          const active = on && (b.sky === p.id || (auto && now === p.id));
          return h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(active),
              class: ['sky-opt', active && 'is-active'],
              dataset: { phase: p.id },
              onClick: () => setBackdrop({ light: 'sky', sky: p.id }),
            },
            h('span', { class: 'sky-opt__icon' }, kitIcon(p.icon, 24)),
            now === p.id && h('span', { class: 'sky-opt__now' }, 'Now'),
            h('span', { class: 'sky-opt__text' }, h('span', { class: 'sky-opt__name' }, p.label), h('span', { class: 'sky-opt__range' }, p.range)),
          );
        }),
      ),
    ),
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
    style: `--fill: ${((value - min) / (max - min)) * 100}%`,
    onInput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format(v);
      e.target.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
      onChange(v);
    },
  });
  return h('div', { class: 'slider' }, h('span', { class: 'slider__label' }, label), input, out);
}

const pct = (v) => `${Math.round(v * 100)}%`;

// Fine-tune stays folded unless you open it; remembered for the session.
let fineTuneOpen = false;

function fineTuneCard() {
  const b = backdrop();
  const details = h(
    'details',
    { class: 'settings__fold', open: fineTuneOpen || null, onToggle: (e) => (fineTuneOpen = e.currentTarget.open) },
    h('summary', null, h('span', null, 'Fine-tune'), h('span', { class: 'settings__hint' }, 'Light, grid, noise and motion')),
    h(
      'div',
      { class: 'settings__rows settings__rows--fold' },
      row(
        'Light',
        segmented(
          [
            ['none', 'Off'],
            ['halo', 'Halo'],
            ['horizon', 'Horizon'],
            ['mesh', 'Mesh'],
            ['spotlight', 'Spot'],
            ['sky', 'Sky'],
          ],
          b.light,
          (v) => setBackdrop({ light: v }),
          'Light',
        ),
        null,
        { stack: true },
      ),
      b.light !== 'none' &&
        block(
          slider({
            label: 'Intensity',
            value: b.lightIntensity,
            min: 0.1,
            max: 1,
            step: 0.05,
            format: pct,
            onChange: (v) => setBackdrop({ lightIntensity: v }),
          }),
        ),
      row(
        'Grid',
        segmented(
          [
            ['none', 'Off'],
            ['lines', 'Lines'],
            ['dots', 'Dots'],
          ],
          b.grid,
          (v) => setBackdrop({ grid: v }),
          'Grid',
        ),
      ),
      b.grid !== 'none' &&
        block(
          slider({ label: 'Size', value: b.gridSize, min: 12, max: 96, step: 4, format: (v) => `${v}px`, onChange: (v) => setBackdrop({ gridSize: v }) }),
          slider({ label: 'Opacity', value: b.gridOpacity, min: 0.1, max: 1, step: 0.05, format: pct, onChange: (v) => setBackdrop({ gridOpacity: v }) }),
        ),
      row(
        'Noise',
        toggle(b.texture !== 'none', (v) => setBackdrop({ texture: v ? 'grain' : 'none' }), 'Noise'),
        'A fine grain that smooths gradients',
      ),
      b.texture !== 'none' &&
        block(
          slider({ label: 'Amount', value: b.textureAmount, min: 0.05, max: 1, step: 0.05, format: pct, onChange: (v) => setBackdrop({ textureAmount: v }) }),
        ),
      row(
        'Motion',
        segmented(
          [
            ['none', 'Off'],
            ['aurora', 'Aurora'],
            ['mesh', 'Flow'],
          ],
          b.shader,
          (v) => setBackdrop({ shader: v }),
          'Animated background',
        ),
      ),
      b.shader !== 'none' &&
        block(
          slider({
            label: 'Intensity',
            value: b.shaderIntensity,
            min: 0.1,
            max: 1,
            step: 0.05,
            format: pct,
            onChange: (v) => setBackdrop({ shaderIntensity: v }),
          }),
          slider({
            label: 'Speed',
            value: b.shaderSpeed,
            min: 0,
            max: 1,
            step: 0.05,
            format: (v) => (v === 0 ? 'Still' : pct(v)),
            onChange: (v) => setBackdrop({ shaderSpeed: v }),
          }),
          h('p', { class: 'settings__hint' }, 'Pauses when the tab is hidden and stays still if your system asks for reduced motion.'),
        ),
    ),
  );
  return h('section', { class: 'settings__card settings__card--fold' }, details);
}

function youCard(p) {
  return card(
    'You',
    row(
      'Name',
      h('input', {
        class: 'field__input settings__input',
        value: p.name,
        placeholder: 'Your first name',
        maxlength: '40',
        'aria-label': 'Your name',
        onChange: (e) => store.setPrefs({ name: e.target.value.trim() }),
      }),
      'For the greeting',
    ),
  );
}

function clockCard(p) {
  return card(
    'Clock & calendar',
    row(
      'Time format',
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
      'Quote under the clock',
      toggle(p.showQuoteOnClock, (v) => store.setPrefs({ showQuoteOnClock: v }), 'Quote under the clock'),
    ),
    row(
      'Week starts on',
      segmented(
        [
          [1, 'Monday'],
          [0, 'Sunday'],
        ],
        p.weekStart,
        (v) => store.setPrefs({ weekStart: v }),
        'Week start',
      ),
    ),
  );
}

function inspirationCard(p) {
  return card(
    'Daily inspiration',
    block(
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
    ),
  );
}

function weatherCard(d, p) {
  return card(
    'Weather',
    row(
      'Location',
      h(
        'button',
        { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: (e) => openLocation(e.currentTarget) },
        icon('location', 14),
        d.location ? d.location.name : 'Set location',
      ),
      'Forecast by Open-Meteo',
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

function focusCard(p) {
  const minutes = (key, options, label) =>
    segmented(
      options.map((v) => [v, `${v}m`]),
      p[key],
      (v) => store.setPrefs({ [key]: v }),
      label,
    );
  return card(
    'Pomodoro',
    row('Focus', minutes('focusMinutes', [15, 25, 45, 60], 'Focus minutes')),
    row('Short break', minutes('shortBreakMinutes', [3, 5, 10], 'Short break minutes')),
    row('Long break', minutes('longBreakMinutes', [10, 15, 20, 30], 'Long break minutes'), 'After every 4th focus session'),
  );
}

function dataCard() {
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
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...store.snapshot(), exportedAt: new Date().toISOString(), app: 'inspira', schema: 2 }, null, 2)], {
      type: 'application/json',
    });
    const a = h('a', { href: URL.createObjectURL(blob), download: `inspira-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return card(
    'Your data',
    row(
      'Privacy',
      h('a', { class: 'ghost-btn ghost-btn--sm', href: 'privacy.html', target: '_blank', rel: 'noopener' }, 'Read policy'),
      'What Inspira stores and where it goes',
    ),
    row(
      'Export',
      h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: exportJson }, 'Download'),
      'Tasks, notes, projects and settings as JSON',
    ),
    row(
      'Import',
      h('button', { type: 'button', class: 'ghost-btn ghost-btn--sm', onClick: () => file.click() }, 'Choose file'),
      'Merged with what’s here — nothing is replaced',
    ),
    file,
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
