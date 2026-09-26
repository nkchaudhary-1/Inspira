// Focus mode (Figma "Home — Pomodoro"). A pomodoro cycle — Focus, Short break,
// and a Long break after every 4th focus — shown on a dot-matrix display.
// The session lives in device storage so every tab shows the same countdown,
// and a chrome.alarm notifies at the end even if no Inspira tab is open.

import * as store from '../core/store.js';
import { todayKey, formatDuration } from '../core/dates.js';
import { h, icon, reactive } from './dom.js';
import { metaFooter } from './hero.js';
import { toast } from './overlay.js';

const alarms = typeof chrome !== 'undefined' ? chrome.alarms : null;
const LONG_EVERY = 4;

export const PHASES = {
  focus: { label: 'Focus', pref: 'focusMinutes' },
  short: { label: 'Short Break', pref: 'shortBreakMinutes' },
  long: { label: 'Long Break', pref: 'longBreakMinutes' },
};

const focusState = () => store.getDevice().focus;
const setFocus = (patch) => store.setDevice({ focus: { ...focusState(), ...patch } });
const phaseMs = (phase) => (store.prefs()[PHASES[phase].pref] || 25) * 60000;
const cycleToday = (f) => (f.cycleDate === todayKey() ? f.cycle || 0 : 0);

/**
 * Ask for notifications once, on the first Start (a user gesture, as Chrome
 * requires). If declined, don't ask again every session — reminders in a
 * task's menu can still ask when someone explicitly turns one on.
 */
function requestNotifications() {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request || store.getDevice().notifyAsked) return;
  store.setDevice({ notifyAsked: true });
  chrome.permissions.request({ permissions: ['notifications'] }).catch(() => {});
}

export function startFocus() {
  const f = focusState();
  const remaining = f.state === 'paused' ? f.remainingMs : phaseMs(f.phase);
  const endsAt = Date.now() + remaining;
  setFocus({ state: 'running', endsAt, remainingMs: null });
  alarms?.create('focus-end', { when: endsAt });
  requestNotifications();
}

export function pauseFocus() {
  const f = focusState();
  if (f.state !== 'running') return;
  setFocus({ state: 'paused', remainingMs: Math.max(0, f.endsAt - Date.now()), endsAt: null });
  alarms?.clear('focus-end');
}

export function togglePause() {
  const f = focusState();
  if (f.state === 'running') pauseFocus();
  else startFocus();
}

export function resetFocus() {
  setFocus({ state: 'idle', endsAt: null, remainingMs: null });
  alarms?.clear('focus-end');
}

export function selectPhase(phase) {
  if (!PHASES[phase]) return;
  setFocus({ phase, state: 'idle', endsAt: null, remainingMs: null });
  alarms?.clear('focus-end');
}

/** Move to the next phase. `completed` counts a finished focus session. */
function advance(completed) {
  const f = focusState();
  let cycle = cycleToday(f);
  let next = 'focus';
  if (f.phase === 'focus') {
    if (completed) cycle += 1;
    next = completed && cycle % LONG_EVERY === 0 ? 'long' : 'short';
  }
  setFocus({ phase: next, state: 'idle', endsAt: null, remainingMs: null, cycle, cycleDate: todayKey() });
  alarms?.clear('focus-end');
  return next;
}

export const skipFocus = () => advance(false);

/** Called by the app ticker each second. */
export function focusTick(now) {
  const f = focusState();
  // Only a visible tab advances the cycle, so two open tabs don't both count it.
  if (f.state !== 'running' || !f.endsAt || now < f.endsAt || document.visibilityState !== 'visible') return;
  const finished = f.phase;
  const next = advance(true);
  chime();
  toast(finished === 'focus' ? `Focus done. Time for a ${next === 'long' ? 'long' : 'short'} break.` : 'Break’s over. Ready when you are.');
}

export function focusRemaining(now) {
  const f = focusState();
  if (f.state === 'running') return Math.max(0, f.endsAt - now);
  if (f.state === 'paused') return f.remainingMs;
  return phaseMs(f.phase);
}

function chime() {
  try {
    const ctx = new AudioContext();
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.7);
    });
  } catch {
    /* audio unavailable */
  }
}

// ---------- dot-matrix display ----------

// 5 × 9 glyphs. 0, 1, 3 and 9 are taken from the Figma cards; the rest follow them.
const GLYPHS = {
  0: ['01110', '10001', '10001', '10011', '10101', '11001', '10001', '10001', '01110'],
  1: ['00100', '01100', '10100', '00100', '00100', '00100', '00100', '00100', '00100'],
  2: ['01110', '10001', '00001', '00001', '00010', '00100', '01000', '10000', '11111'],
  3: ['01110', '10001', '00001', '00001', '00110', '00001', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '10010', '11111', '00010', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '00001', '10001', '01110'],
  6: ['01110', '10001', '10000', '10000', '11110', '10001', '10001', '10001', '01110'],
  7: ['11111', '00001', '00001', '00010', '00100', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '10001', '01110', '10001', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '10001', '01111', '00001', '00001', '10001', '01110'],
};

function digitCard() {
  return h(
    'div',
    { class: 'matrix__card' },
    Array.from({ length: 45 }, () => h('i', { class: 'matrix__dot' })),
  );
}

function paintCard(card, digit) {
  if (card.dataset.d === digit) return;
  card.dataset.d = digit;
  const rows = GLYPHS[digit] || GLYPHS[0];
  const dots = card.children;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) dots[r * 5 + c].classList.toggle('is-on', rows[r][c] === '1');
}

function matrix(ms) {
  const el = h(
    'div',
    { class: 'matrix', role: 'timer', 'aria-label': `Time remaining ${formatDuration(ms)}` },
    digitCard(),
    digitCard(),
    h('div', { class: 'matrix__colon', 'aria-hidden': 'true' }, h('i', { class: 'matrix__dot is-on' }), h('i', { class: 'matrix__dot is-on' })),
    digitCard(),
    digitCard(),
  );
  paintMatrix(el, ms);
  return el;
}

function paintMatrix(el, ms) {
  const text = formatDuration(ms).replace(':', '').padStart(4, '0').slice(-4);
  const cards = el.querySelectorAll('.matrix__card');
  cards.forEach((card, i) => paintCard(card, text[i]));
  el.setAttribute('aria-label', `Time remaining ${formatDuration(ms)}`);
}

/** Ticker hook: repaint any on-screen matrix. */
export function paintFocus(now) {
  const els = document.querySelectorAll('.matrix');
  if (!els.length) return;
  const ms = focusRemaining(now);
  els.forEach((el) => paintMatrix(el, ms));
}

// ---------- view ----------

export function focusView() {
  return reactive(
    h('section', { class: 'pomodoro', 'aria-label': 'Focus timer' }),
    () => {
      const f = focusState();
      const p = store.prefs();
      const running = f.state === 'running';
      const cycle = cycleToday(f);
      const inCycle = cycle % LONG_EVERY;
      const done = f.phase === 'long' && f.state === 'idle' && cycle > 0 && inCycle === 0 ? LONG_EVERY : inCycle;

      const tabs = h(
        'div',
        { class: 'pill-tabs', role: 'tablist', 'aria-label': 'Timer' },
        Object.entries(PHASES).map(([id, { label, pref }]) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': String(f.phase === id),
              class: ['pill-tabs__tab', f.phase === id && 'is-active'],
              onClick: () => f.phase !== id && selectPhase(id),
            },
            `${label} ${p[pref]}m`,
          ),
        ),
      );

      const primaryLabel = running ? 'Pause' : f.state === 'paused' ? 'Resume' : 'Start';
      const controls = h(
        'div',
        { class: 'pomodoro__controls' },
        h('button', { type: 'button', class: 'pill-btn', onClick: resetFocus, title: 'Reset (R)' }, 'Reset'),
        h('button', { type: 'button', class: 'pill-btn pill-btn--primary', onClick: togglePause, title: `${primaryLabel} (Space)` }, primaryLabel),
        h('button', { type: 'button', class: 'pill-btn', onClick: skipFocus, title: 'Skip to next (S)' }, 'Skip'),
      );

      const sessions = h(
        'div',
        { class: 'pomodoro__sessions', title: `${cycle} focus session${cycle === 1 ? '' : 's'} today` },
        Array.from({ length: LONG_EVERY }, (_, i) => h('i', { class: ['pomodoro__pip', i < done && 'is-done'] })),
        h('span', null, cycle ? `${cycle} today` : 'Session 1'),
      );

      const intention = h('input', {
        class: 'pomodoro__intention',
        value: f.intention || '',
        placeholder: 'What are you focusing on?',
        'aria-label': 'Focus intention',
        maxlength: '120',
        id: 'focus-input',
        onInput: (e) => setFocus({ intention: e.target.value }),
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
        },
      });

      return [
        tabs,
        h(
          'div',
          { class: ['pomodoro__center', f.state === 'paused' && 'is-paused', f.phase !== 'focus' && 'is-break'] },
          matrix(focusRemaining(Date.now())),
          controls,
          sessions,
          intention,
        ),
        metaFooter(),
      ];
    },
    () => [focusState(), store.prefs(), todayKey()],
  );
}

// ---------- mini timer ----------

const RING = 2 * Math.PI * 7;

/**
 * A small pill that follows the running (or paused) pomodoro onto every other
 * page: phase, progress ring and countdown. Click opens Focus; the button
 * pauses / resumes in place. Hidden on the Focus page itself (CSS).
 */
export function focusMini(openFocus) {
  return reactive(
    h('div', { class: 'focus-mini-wrap' }),
    () => {
      const f = focusState();
      if (f.state !== 'running' && f.state !== 'paused') return null;
      const running = f.state === 'running';
      const phase = PHASES[f.phase]?.label || 'Focus';
      const el = h(
        'div',
        { class: ['focus-mini', !running && 'is-paused', f.phase !== 'focus' && 'is-break'], role: 'group', 'aria-label': `${phase} timer` },
        h(
          'button',
          {
            type: 'button',
            class: 'focus-mini__open',
            title: f.intention ? `${f.intention} · open Focus (3)` : 'Open Focus (3)',
            onClick: openFocus,
          },
          h('svg', { class: 'focus-mini__ring', viewBox: '0 0 18 18', 'aria-hidden': 'true' }, [
            h('circle', { cx: '9', cy: '9', r: '7' }),
            h('circle', { class: 'focus-mini__arc', cx: '9', cy: '9', r: '7', 'stroke-dasharray': RING.toFixed(2) }),
          ]),
          h('span', { class: 'focus-mini__label' }, running ? phase : 'Paused'),
          h('span', { class: 'focus-mini__time', role: 'timer' }),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'focus-mini__toggle',
            'aria-label': running ? 'Pause timer' : 'Resume timer',
            title: running ? 'Pause' : 'Resume',
            onClick: togglePause,
          },
          icon(running ? 'pause' : 'play', 14),
        ),
      );
      paintMini(el, Date.now());
      return el;
    },
    () => [focusState(), store.prefs()],
  );
}

/** Ticker hook: keep the mini timer's countdown and ring current. */
export function paintFocusMini(now) {
  const el = document.querySelector('.focus-mini');
  if (el) paintMini(el, now);
}

function paintMini(el, now) {
  const ms = focusRemaining(now);
  const time = el.querySelector('.focus-mini__time');
  const text = formatDuration(ms);
  if (time.textContent !== text) time.textContent = text;
  const left = Math.min(1, ms / phaseMs(focusState().phase));
  el.querySelector('.focus-mini__arc').setAttribute('stroke-dashoffset', (RING * (1 - left)).toFixed(2));
}
