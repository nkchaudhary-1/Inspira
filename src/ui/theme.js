// Theme + atmosphere. Theme resolves Auto → system preference. The sky layer
// reads `data-daypart` and `data-sky` (weather group) for its gradient.

import * as store from '../core/store.js';
import { daypart } from '../core/dates.js';
import { describe } from '../services/weather.js';
import { applyBackdrop, applySkyPhase, backdrop } from './backdrop.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

export function applyTheme() {
  const pref = store.prefs().theme;
  const theme = pref === 'system' ? (media.matches ? 'dark' : 'light') : pref;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  const w = store.getDevice().weather;
  const sky = w ? describe(w.code).group : 'clear';
  if (root.dataset.sky !== sky) root.dataset.sky = sky;
  applyBackdrop();
  // Cache for first paint on the next tab (see src/paint.js).
  const { texture, grid, light } = backdrop();
  try {
    localStorage.setItem('inspira.paint', JSON.stringify({ theme, sky, texture, grid, light }));
  } catch {
    /* ignore */
  }
}

export function applyDaypart(now = new Date()) {
  const part = daypart(now.getHours());
  if (root.dataset.daypart !== part) root.dataset.daypart = part;
  applySkyPhase(now);
}

export function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(store.prefs().theme) + 1) % order.length];
  store.setPrefs({ theme: next });
  return next;
}

export function initTheme() {
  media.addEventListener('change', applyTheme);
  store.subscribe(applyTheme);
  applyTheme();
  applyDaypart();
}
