// Dock: hidden by default so the tab stays calm. A faint ••• handle (or the
// very bottom edge of the screen) reveals a macOS-style dock with the modes
// and utilities; icons magnify toward the pointer.

import * as store from '../core/store.js';
import { h, icon, reactive } from './dom.js';
import { MODES, setMode, currentMode } from './modes.js';
import { openSettings } from './settings.js';
import { openShortcuts } from './shortcuts.js';
import { cycleTheme } from './theme.js';

const CLOSE_DELAY = 450;
const MAX_SCALE = 1.45;
const REACH = 130; // px from pointer where magnification fades out
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function item({ id, label, keyHint, iconName, active, badge, onClick }) {
  return h(
    'button',
    {
      type: 'button',
      class: ['dock__item', active && 'is-active'],
      'aria-label': keyHint ? `${label} (${keyHint})` : label,
      'aria-current': active ? 'page' : null,
      dataset: { id },
      onClick,
    },
    h('span', { class: 'dock__tile' }, icon(iconName, 20), badge && h('i', { class: 'dock__badge' })),
    h('span', { class: 'dock__label', 'aria-hidden': 'true' }, label, keyHint && h('kbd', null, keyHint)),
    h('i', { class: 'dock__dot', 'aria-hidden': 'true' }),
  );
}

export function dock() {
  let closeTimer = null;

  const nav = reactive(h('nav', { class: 'dock', 'aria-label': 'Inspira' }), () => {
    const mode = currentMode() || store.getDevice().mode;
    const dark = document.documentElement.dataset.theme === 'dark';
    const pref = store.prefs().theme;
    return [
      MODES.map((m) => item({ id: m.id, label: m.label, keyHint: m.key, iconName: m.icon, active: m.id === mode, onClick: () => setMode(m.id) })),
      h('span', { class: 'dock__divider', 'aria-hidden': 'true' }),
      item({ id: 'shortcuts', label: 'Shortcuts', keyHint: '?', iconName: 'keyboard', onClick: openShortcuts }),
      item({
        id: 'theme',
        label: `Theme · ${pref === 'system' ? 'Auto' : pref[0].toUpperCase() + pref.slice(1)}`,
        keyHint: 'D',
        iconName: dark ? 'moon' : 'sun',
        onClick: cycleTheme,
      }),
      item({ id: 'settings', label: 'Settings', keyHint: ',', iconName: 'settings', badge: store.ui.syncStatus === 'error', onClick: openSettings }),
    ];
  });

  const handle = h('button', { type: 'button', class: 'dock-handle', 'aria-label': 'Show menu', 'aria-expanded': 'false' }, icon('more', 22));
  const edge = h('div', { class: 'dock-edge', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'dock-wrap' }, handle, nav);

  const open = () => {
    clearTimeout(closeTimer);
    if (wrap.classList.contains('is-open')) return;
    wrap.classList.add('is-open');
    handle.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    clearTimeout(closeTimer);
    wrap.classList.remove('is-open');
    handle.setAttribute('aria-expanded', 'false');
    resetScale();
  };
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (wrap.matches(':hover')) return;
      if (wrap.contains(document.activeElement)) document.activeElement.blur();
      close();
    }, CLOSE_DELAY);
  };

  // Hover: handle or bottom edge opens; leaving the dock closes after a beat.
  handle.addEventListener('pointerenter', open);
  edge.addEventListener('pointerenter', open);
  nav.addEventListener('pointerenter', open);
  wrap.addEventListener('pointerleave', closeSoon);

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

  // Magnification.
  function resetScale() {
    for (const el of nav.querySelectorAll('.dock__item')) el.style.removeProperty('--s');
  }
  nav.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduceMotion()) return;
    for (const el of nav.querySelectorAll('.dock__item')) {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / REACH);
      el.style.setProperty('--s', (1 + (MAX_SCALE - 1) * t * t * (3 - 2 * t)).toFixed(3));
    }
  });
  nav.addEventListener('pointerleave', resetScale);

  return [edge, wrap];
}
