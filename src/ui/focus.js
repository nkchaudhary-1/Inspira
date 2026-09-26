// Focus mode: one intention, one timer, nothing else. The session lives in
// device storage (so every tab shows the same countdown) and a chrome.alarm
// notifies at the end even if no Inspira tab is open.

import * as store from '../core/store.js';
import { todayKey, formatDuration } from '../core/dates.js';
import { h, icon, reactive } from './dom.js';
import { clock } from './hero.js';

const DURATIONS = [15, 25, 45, 60];
const alarms = typeof chrome !== 'undefined' ? chrome.alarms : null;

const focusState = () => store.getDevice().focus;
const setFocus = (patch) => store.setDevice({ focus: { ...focusState(), ...patch } });

export function startFocus() {
  const f = focusState();
  const minutes = f.minutes || store.prefs().focusMinutes;
  const endsAt = Date.now() + minutes * 60000;
  setFocus({ state: 'running', endsAt, remainingMs: null, minutes });
  alarms?.create('focus-end', { when: endsAt });
  if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
    chrome.permissions.request({ permissions: ['notifications'] }).catch(() => {});
  }
}

export function togglePause() {
  const f = focusState();
  if (f.state === 'running') {
    setFocus({ state: 'paused', remainingMs: f.endsAt - Date.now(), endsAt: null });
    alarms?.clear('focus-end');
  } else if (f.state === 'paused') {
    const endsAt = Date.now() + f.remainingMs;
    setFocus({ state: 'running', endsAt, remainingMs: null });
    alarms?.create('focus-end', { when: endsAt });
  } else if (f.state === 'idle') {
    startFocus();
  }
}

export function endFocus() {
  setFocus({ state: 'idle', endsAt: null, remainingMs: null });
  alarms?.clear('focus-end');
}

/** Called by the app ticker each second. */
export function focusTick(now) {
  const f = focusState();
  if (f.state === 'running' && f.endsAt && now >= f.endsAt) {
    setFocus({ state: 'done', endsAt: null, remainingMs: null });
    if (document.visibilityState === 'visible') chime();
  }
}

export function focusRemaining(now) {
  const f = focusState();
  if (f.state === 'running') return f.endsAt - now;
  if (f.state === 'paused') return f.remainingMs;
  return (f.minutes || store.prefs().focusMinutes) * 60000;
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

export function focusView() {
  return reactive(h('section', { class: 'focus', 'aria-label': 'Focus' }), () => {
    const f = focusState();
    if (f.state === 'running' || f.state === 'paused') return runningView(f);
    if (f.state === 'done') return doneView(f);
    return idleView(f);
  });
}

function idleView(f) {
  const openTasks = store.tasksForDate(todayKey()).filter((t) => !t.done);
  const intention = f.intention || '';
  const input = h('input', {
    class: 'focus__input',
    value: intention,
    placeholder: 'What’s the one thing?',
    'aria-label': 'Focus intention',
    maxlength: '140',
    id: 'focus-input',
    onInput: (e) => setFocus({ intention: e.target.value, taskId: null }),
    onKeydown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
        startFocus();
      }
    },
  });
  const minutes = f.minutes || store.prefs().focusMinutes;
  return [
    clock('focus'),
    h('div', { class: 'eyebrow focus__label' }, 'Focus'),
    input,
    openTasks.length > 0 &&
      h(
        'div',
        { class: 'focus__suggest' },
        openTasks
          .slice(0, 3)
          .map((t) =>
            h(
              'button',
              { type: 'button', class: ['chip', f.taskId === t.id && 'is-active'], onClick: () => setFocus({ intention: t.title, taskId: t.id }) },
              t.title,
            ),
          ),
      ),
    h(
      'div',
      { class: 'focus__durations', role: 'radiogroup', 'aria-label': 'Duration' },
      DURATIONS.map((m) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(m === minutes),
            class: ['chip', m === minutes && 'is-active'],
            onClick: () => setFocus({ minutes: m }),
          },
          `${m} min`,
        ),
      ),
    ),
    h('button', { type: 'button', class: 'primary-btn', onClick: startFocus }, icon('play', 14), 'Start focus'),
  ];
}

function runningView(f) {
  const paused = f.state === 'paused';
  return [
    h('div', { class: 'eyebrow focus__label' }, paused ? 'Paused' : `Focus · ${f.minutes} min`),
    h(
      'div',
      { class: ['focus__timer', paused && 'is-paused'], dataset: { bind: 'focus-remaining' }, role: 'timer', 'aria-label': 'Time remaining' },
      formatDuration(focusRemaining(Date.now())),
    ),
    h('div', { class: 'focus__progress' }, h('span', { dataset: { bind: 'focus-progress' } })),
    h('p', { class: 'focus__intention' }, f.intention || 'Deep work'),
    h(
      'div',
      { class: 'focus__actions' },
      h('button', { type: 'button', class: 'ghost-btn', onClick: togglePause }, icon(paused ? 'play' : 'pause', 14), paused ? 'Resume' : 'Pause'),
      h('button', { type: 'button', class: 'ghost-btn', onClick: endFocus }, icon('stop', 14), 'End'),
    ),
    h('div', { class: 'focus__clock' }, clock('small')),
  ];
}

function doneView(f) {
  const task = f.taskId ? store.getData().tasks[f.taskId] : null;
  return [
    h('div', { class: 'eyebrow focus__label' }, 'Session complete'),
    h('p', { class: 'focus__done' }, 'Nicely done.'),
    f.intention && h('p', { class: 'focus__intention' }, f.intention),
    h(
      'div',
      { class: 'focus__actions' },
      task &&
        !task.done &&
        h('button', { type: 'button', class: 'primary-btn', onClick: () => (store.toggleTask(task.id), endFocus()) }, icon('check', 14), 'Mark task done'),
      h('button', { type: 'button', class: 'ghost-btn', onClick: startFocus }, 'Another round'),
      h('button', { type: 'button', class: 'ghost-btn', onClick: endFocus }, 'Finish'),
    ),
  ];
}
