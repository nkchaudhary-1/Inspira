// Keyboard shortcuts. Single keys, ignored while typing (except Escape).

import * as store from '../core/store.js';
import { h } from './dom.js';
import { closeOverlay, overlayOpen, openSheet } from './overlay.js';
import { setMode, currentMode, MODES } from './modes.js';
import { shiftCalendar, calendarToday, setCalView } from './calendarPage.js';
import { shiftWeek, tasksToday, setTasksView, focusAddTask } from './tasksPage.js';
import { nextQuote } from './hero.js';
import { createNote, closeNote } from './notes.js';
import { togglePause, resetFocus, skipFocus } from './focus.js';
import { openSettings } from './settings.js';
import { cycleTheme } from './theme.js';

export const SHORTCUTS = [
  ['1 – 5', 'Clock · Quote · Focus · Tasks · Calendar'],
  ['← / →', 'Previous / next week (Tasks) or period (Calendar)'],
  ['T', 'Jump to today'],
  ['C', 'Calendar'],
  ['P', 'Projects'],
  ['N', 'New task for today'],
  ['Del', 'Delete the focused task (Undo in the toast)'],
  ['M', 'New note for the selected day'],
  ['Q', 'Another quote'],
  ['Space', 'Start / pause the timer (Focus)'],
  ['R / S', 'Reset / skip the timer (Focus)'],
  ['D', 'Cycle light / dark / auto'],
  [',', 'Settings'],
  ['?', 'This list'],
  ['Esc', 'Close / cancel'],
];

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/** Switch to `mode` (if needed), then run `fn` once its page is on screen. */
function inMode(mode, selector, fn) {
  if (currentMode() === mode) return fn();
  setMode(mode);
  // The mode switch may run inside a view transition; wait for the page.
  let frames = 0;
  const wait = () => (document.querySelector(selector) || ++frames > 30 ? fn() : requestAnimationFrame(wait));
  requestAnimationFrame(wait);
}

const afterRender = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openShortcuts() {
  openSheet(
    'Keyboard shortcuts',
    h(
      'dl',
      { class: 'shortcuts' },
      SHORTCUTS.map(([k, v]) => [
        h(
          'dt',
          null,
          k.split(' / ').map((part, i) => [i ? ' / ' : '', h('kbd', null, part)]),
        ),
        h('dd', null, v),
      ]),
    ),
  );
}

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      if (closeOverlay()) return;
      if (store.ui.openNoteId) return closeNote();
      if (typing(document.activeElement)) return document.activeElement.blur();
      return;
    }
    if (typing(document.activeElement)) return;
    if (overlayOpen() && !['?'].includes(e.key)) return;

    const mode = MODES.find((m) => m.key === e.key);
    if (mode) return setMode(mode.id);

    const current = currentMode();
    // Space is reserved for buttons that have focus.
    const onButton = document.activeElement?.tagName === 'BUTTON';

    switch (e.key.toLowerCase()) {
      case 'arrowleft':
      case 'arrowright': {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (current === 'tasks' && store.getDevice().tasksView === 'week') {
          e.preventDefault();
          shiftWeek(dir);
        } else if (current === 'calendar') {
          e.preventDefault();
          shiftCalendar(dir);
        }
        break;
      }
      case 't':
        if (current === 'tasks') tasksToday();
        else inMode('calendar', '.page--calendar', calendarToday);
        break;
      case 'c':
        setMode('calendar');
        break;
      case 'p':
        inMode('tasks', '.page--tasks', () => setTasksView('projects'));
        break;
      case 'n':
        e.preventDefault();
        inMode('tasks', '.page--tasks', () => {
          if (store.getDevice().tasksView !== 'week') setTasksView('week');
          tasksToday();
          afterRender(() => focusAddTask());
        });
        break;
      case 'm':
        e.preventDefault();
        inMode('calendar', '.page--calendar', () => {
          setCalView('day');
          afterRender(() => createNote({ date: store.ui.date }));
        });
        break;
      case 'q':
        nextQuote();
        break;
      case 'd':
        cycleTheme();
        break;
      case 'r':
        if (current === 'focus') resetFocus();
        break;
      case 's':
        if (current === 'focus') skipFocus();
        break;
      case ',':
        openSettings();
        break;
      case '?':
        openShortcuts();
        break;
      case ' ':
        if (current === 'focus' && !onButton) {
          e.preventDefault();
          togglePause();
        }
        break;
    }
  });
}
