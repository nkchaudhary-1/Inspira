// Dock: hidden by default so the tab stays calm. A faint ••• handle (or the
// very bottom edge of the screen) reveals a macOS-style dock with the modes
// and utilities. It fades in place — no genie rise, no magnification.

import * as store from '../core/store.js';
import { h, icon, reactive } from './dom.js';
import { navIcon } from './navIcons.js';
import { MODES, setMode, currentMode } from './modes.js';
import { openSettings } from './settings.js';
import { openShortcuts } from './shortcuts.js';
import { cycleTheme } from './theme.js';

const CLOSE_DELAY = 450;

function item({ id, label, keyHint, iconName, active, badge, onClick, index = 0 }) {
  return h(
    'button',
    {
      type: 'button',
      class: ['dock__item', active && 'is-active'],
      'aria-label': keyHint ? `${label} (${keyHint})` : label,
      'aria-current': active ? 'page' : null,
      dataset: { id },
      style: `--i: ${index}`,
      onClick,
    },
    h('span', { class: 'dock__tile' }, navIcon(iconName, 22), badge && h('i', { class: 'dock__badge' })),
    h('span', { class: 'dock__label', 'aria-hidden': 'true' }, label, keyHint && h('kbd', null, keyHint)),
    h('i', { class: 'dock__dot', 'aria-hidden': 'true' }),
  );
}

export function dock() {
  let closeTimer = null;

  const nav = reactive(
    h('nav', { class: 'dock', 'aria-label': 'Inspira' }),
    () => {
      const mode = currentMode() || store.getDevice().mode;
      const dark = document.documentElement.dataset.theme === 'dark';
      const pref = store.prefs().theme;
      return [
        MODES.map((m, i) =>
          item({ index: i, id: m.id, label: m.label, keyHint: m.key, iconName: m.icon, active: m.id === mode, onClick: () => setMode(m.id) }),
        ),
        h('span', { class: 'dock__divider', 'aria-hidden': 'true' }),
        item({ index: 5, id: 'shortcuts', label: 'Shortcuts', keyHint: '?', iconName: 'keyboard', onClick: openShortcuts }),
        item({
          index: 6,
          id: 'theme',
          label: `Theme · ${pref === 'system' ? 'Auto' : pref[0].toUpperCase() + pref.slice(1)}`,
          keyHint: 'D',
          iconName: dark ? 'themeDark' : 'themeLight',
          onClick: cycleTheme,
        }),
        item({
          index: 7,
          id: 'settings',
          label: 'Settings',
          keyHint: ',',
          iconName: 'settings',
          badge: store.ui.syncStatus === 'error',
          onClick: () => openSettings(),
        }),
      ];
    },
    () => [currentMode() || store.getDevice().mode, document.documentElement.dataset.theme, store.prefs().theme, store.ui.syncStatus],
  );

  const handle = h('button', { type: 'button', class: 'dock-handle', 'aria-label': 'Show menu', 'aria-expanded': 'false' }, icon('more', 22));
  const edge = h('div', { class: 'dock-edge', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'dock-wrap' }, handle, nav);

  const open = () => {
    clearTimeout(closeTimer);
    if (wrap.classList.contains('is-open')) return;
    wrap.classList.add('is-open', 'is-opening');
    handle.setAttribute('aria-expanded', 'true');
    // The dock appears where the handle was: ignore the click that opened it.
    setTimeout(() => wrap.classList.remove('is-opening'), 350);
  };
  const close = () => {
    clearTimeout(closeTimer);
    wrap.classList.remove('is-open');
    handle.setAttribute('aria-expanded', 'false');
  };
  // Track the pointer ourselves: :hover isn't re-evaluated until the mouse
  // moves, so a still pointer resting on the dock could read as "gone".
  let inside = false;
  wrap.addEventListener('pointerenter', () => (inside = true));
  wrap.addEventListener('pointerleave', () => (inside = false));
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (inside || wrap.matches(':hover')) return;
      if (wrap.contains(document.activeElement)) document.activeElement.blur();
      close();
    }, CLOSE_DELAY);
  };

  // Hover: handle or bottom edge opens; leaving the dock closes after a beat.
  // Hover-to-open is for mice only; touch opens with a tap on the handle.
  const hoverOpen = (e) => e.pointerType === 'mouse' && open();
  handle.addEventListener('pointerenter', hoverOpen);
  edge.addEventListener('pointerenter', hoverOpen);
  nav.addEventListener('pointerenter', hoverOpen);
  wrap.addEventListener('pointerleave', closeSoon);

  // The dock appears where the handle was: swallow a click that lands while it
  // is still opening, without making it unhoverable (which would close it).
  nav.addEventListener(
    'click',
    (e) => {
      if (!wrap.classList.contains('is-opening')) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  // Touch / click / keyboard.
  handle.addEventListener('click', () => {
    open();
    nav.querySelector('.dock__item.is-active, .dock__item')?.focus({ preventScroll: true });
  });
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget)) closeSoon();
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.classList.contains('is-open')) {
      e.stopPropagation();
      close();
      handle.focus();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const items = [...nav.querySelectorAll('.dock__item')];
      const i = items.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      e.stopPropagation();
      items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length].focus();
    }
  });

  return [edge, wrap];
}
