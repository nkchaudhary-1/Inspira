// Inspira bootstrap: load state, paint the stage for the current mode, then
// start the ticker and background services (weather, calendar, sync).

import * as store from './core/store.js';
import { clockParts, formatLong, formatFull, todayKey, greeting, formatDuration } from './core/dates.js';
import { refreshWeather } from './services/weather.js';
import { loadMonth } from './services/calendar.js';
import { startSync } from './services/sync.js';
import { h, icon } from './ui/dom.js';
import { clock, fullDateLine, greetingLine, quote, weather, metaFooter } from './ui/hero.js';
import { focusView, focusTick, focusRemaining, paintFocus, focusMini, paintFocusMini, PHASES } from './ui/focus.js';
import { tasksPage } from './ui/tasksPage.js';
import { calendarPage } from './ui/calendarPage.js';
import { registerStage, currentMode, setMode } from './ui/modes.js';
import { dock } from './ui/dock.js';
import { initShortcuts } from './ui/shortcuts.js';
import { initTheme, applyDaypart } from './ui/theme.js';

function renderMode(mode) {
  const p = store.prefs();
  switch (mode) {
    case 'motivation':
      // Figma "Home — Daily Quote": greeting, the day's line, date + time + weather.
      return h('div', { class: 'layout layout--quote' }, greetingLine(), quote('display'), metaFooter());
    case 'focus':
      return h('div', { class: 'layout layout--focus' }, focusView());
    case 'tasks':
      return h('div', { class: 'layout layout--page' }, tasksPage());
    case 'calendar':
      return h('div', { class: 'layout layout--page' }, calendarPage());
    case 'clock':
    default:
      return h(
        'div',
        { class: 'layout layout--clock' },
        // Figma "Inspira 2.0 / Clock": date + line top-left, display clock, weather bottom-left.
        h(
          'div',
          { class: 'clockface' },
          h('header', { class: 'clockface__top' }, fullDateLine(), p.showQuoteOnClock && quote('line')),
          clock('display'),
          weather('display'),
        ),
      );
  }
}

// ---------- ticker ----------

let lastToday = todayKey();

function setAll(bind, value) {
  for (const el of document.querySelectorAll(`[data-bind="${bind}"]`)) if (el.textContent !== value) el.textContent = value;
}

function tick() {
  const now = new Date();
  const p = store.prefs();
  const { time, meridiem } = clockParts(now, p.clock24, p.showSeconds);
  setAll('time', time);
  setAll('meridiem', meridiem);
  const today = todayKey(now);
  setAll('date', formatLong(today));
  setAll('date-full', formatFull(today));
  setAll('greeting', `${greeting(now.getHours())}${p.name ? `, ${p.name}` : ''}`);

  focusTick(now.getTime());
  const f = store.getDevice().focus;
  const remaining = focusRemaining(now.getTime());
  paintFocus(now.getTime());
  paintFocusMini(now.getTime());
  const title = f.state === 'running' ? `${formatDuration(remaining)} · ${PHASES[f.phase]?.label || 'Focus'}` : 'New Tab';
  if (document.title !== title) document.title = title;

  applyDaypart(now);

  // Midnight rollover: follow "today" if the user was looking at it.
  if (today !== lastToday) {
    if (store.ui.date === lastToday) store.setUI({ date: today });
    lastToday = today;
    rerender();
    loadMonth(today);
  }
}

function startTicker() {
  tick();
  const loop = () => {
    tick();
    setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
  };
  setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
}

// ---------- stage ----------

let stage;
let paint;
let signature = '';
const signatureOf = (mode) => {
  const p = store.prefs();
  return `${mode}|${p.showQuoteOnClock}`;
};

function rerender() {
  paint(currentMode() || store.getDevice().mode);
}

async function boot() {
  await store.init();
  initTheme();

  const app = document.getElementById('app');
  stage = h('main', { class: 'stage', id: 'stage' });
  app.replaceChildren(
    stage,
    focusMini(() => setMode('focus')),
    ...dock(),
  );

  paint = (mode) => {
    signature = signatureOf(mode);
    app.dataset.mode = mode;
    const layout = renderMode(mode);
    // Entrance motion only on a fresh paint, never on reactive re-renders.
    layout.classList.add('is-entering');
    setTimeout(() => layout.classList.remove('is-entering'), 1000);
    stage.replaceChildren(layout);
    tick();
  };
  registerStage(paint);
  paint(store.getDevice().mode);

  // Layout-affecting prefs re-paint the stage.
  store.subscribe(() => {
    const mode = currentMode();
    if (mode && signatureOf(mode) !== signature) paint(mode);
  });

  startTicker();
  initShortcuts();

  refreshWeather();
  setInterval(() => refreshWeather(), 15 * 60 * 1000);
  if (store.getDevice().calendarConnected) loadMonth(store.ui.date);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshWeather();
    loadMonth(store.ui.date);
    tick();
  });
  startSync();

  firstRunHint();
}

function firstRunHint() {
  if (store.getDevice().hintsSeen) return;
  const hint = h('div', { class: 'hint' }, 'Tip: hover the dots below for the menu · ', h('kbd', null, '1'), '–', h('kbd', null, '5'), ' to switch views');
  document.body.append(hint);
  const dismiss = () => {
    hint.classList.add('is-leaving');
    setTimeout(() => hint.remove(), 400);
    store.setDevice({ hintsSeen: true });
    document.removeEventListener('keydown', dismiss);
  };
  document.addEventListener('keydown', dismiss);
  setTimeout(dismiss, 9000);
}

boot().catch((err) => {
  console.error('[inspira] failed to start', err);
  document.getElementById('app').textContent = 'Inspira couldn’t start. Try reloading the tab.';
});

// Kept for debugging from the console.
globalThis.__inspira = { store, icon };
