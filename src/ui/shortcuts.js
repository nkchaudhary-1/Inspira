// Keyboard shortcuts. Single keys, ignored while typing (except Escape).

import * as store from '../core/store.js';
import { todayKey } from '../core/dates.js';
import { h } from './dom.js';
import { closeOverlay, overlayOpen, openSheet } from './overlay.js';
import { setMode, currentMode, MODES } from './modes.js';
import { shiftDay, goToDate, openProjects } from './workspace.js';
import { openCalendar } from './calendar.js';
import { nextQuote } from './hero.js';
import { createNote, closeNote } from './notes.js';
import { togglePause } from './focus.js';
import { openSettings } from './settings.js';
import { cycleTheme } from './theme.js';

export const SHORTCUTS = [
  ['1 – 4', 'Clock · Motivation · Focus · Plan'],
  ['← / →', 'Previous / next day'],
  ['T', 'Jump to today'],
  ['C', 'Open calendar'],
  ['P', 'Projects'],
  ['N', 'New task'],
  ['M', 'New note'],
  ['Q', 'Another quote'],
  ['Space', 'Start / pause focus (in Focus)'],
  ['D', 'Cycle light / dark / auto'],
  [',', 'Settings'],
  ['?', 'This list'],
  ['Esc', 'Close / cancel'],
];

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

function inPlan(fn) {
  if (currentMode() === 'plan') return fn();
  setMode('plan');
  // The mode switch may run inside a view transition; wait for the workspace.
  let frames = 0;
  const wait = () => (document.querySelector('.workspace') || ++frames > 30 ? fn() : requestAnimationFrame(wait));
  requestAnimationFrame(wait);
}

function focusComposer() {
  inPlan(() => {
    if (store.ui.view !== 'day') store.setUI({ view: 'day' });
    requestAnimationFrame(() => document.getElementById('plan-composer')?.focus());
  });
}

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

    // Space is reserved for buttons that have focus.
    const onButton = document.activeElement?.tagName === 'BUTTON';

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        inPlan(() => shiftDay(e.key === 'ArrowLeft' ? -1 : 1));
        break;
      case 't':
      case 'T':
        inPlan(() => goToDate(todayKey()));
        break;
      case 'c':
      case 'C':
        inPlan(() => {
          const anchor = document.getElementById('daynav-title');
          if (anchor) openCalendar(anchor, goToDate);
        });
        break;
      case 'p':
      case 'P':
        inPlan(() => openProjects());
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        focusComposer();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        inPlan(() => {
          if (store.ui.view !== 'day') store.setUI({ view: 'day' });
          createNote({ date: store.ui.date });
        });
        break;
      case 'q':
      case 'Q':
        nextQuote();
        break;
      case 'd':
      case 'D':
        cycleTheme();
        break;
      case ',':
        openSettings();
        break;
      case '?':
        openShortcuts();
        break;
      case ' ':
        if (currentMode() === 'focus' && !onButton) {
          e.preventDefault();
          togglePause();
        }
        break;
    }
  });
}
