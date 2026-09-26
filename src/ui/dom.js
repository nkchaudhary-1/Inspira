// Minimal DOM toolkit: `h` builds elements, `reactive` re-renders a region on
// store changes without stealing focus from an input the user is typing in.

import { subscribe } from '../core/store.js';

export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'value' || key === 'checked' || key === 'textContent') el[key] = value;
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Track pointer state so a deferred re-render never swaps out a button between
// mousedown (which blurs the input) and click.
let pointerDown = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (pointerDown = true), true);
  window.addEventListener('pointerup', () => setTimeout(() => (pointerDown = false), 0), true);
}

const isEditing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Render `render()` into `container` now and on every store change. While the
 * user is typing inside the container, re-render is deferred until focus leaves.
 */
export function reactive(container, render) {
  let dirty = false;
  const run = () => {
    if (!container.isConnected && container.dataset.mounted) return unsubscribe();
    const active = document.activeElement;
    if (active && container.contains(active) && isEditing(active)) {
      dirty = true;
      return;
    }
    dirty = false;
    container.dataset.mounted = '1';
    container.replaceChildren(...[render()].flat(Infinity).filter(Boolean));
  };
  const unsubscribe = subscribe(run);
  container.addEventListener('focusout', () => {
    if (!dirty) return;
    if (pointerDown) window.addEventListener('pointerup', () => setTimeout(run, 0), { once: true, capture: true });
    else setTimeout(run, 0);
  });
  run();
  return container;
}

// ---------- icons (1.5px stroke, 20px grid) ----------

const PATHS = {
  clock: 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 6.5V10l2.5 1.5',
  sparkle: 'M10 3.5l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5z',
  target: 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  checklist: 'M9 6h6.5M9 10h6.5M9 14h6.5M4.5 6l1 1 1.8-2M4.5 10l1 1 1.8-2M4.5 14l1 1 1.8-2',
  chevronLeft: 'M12.5 5l-5 5 5 5',
  chevronRight: 'M7.5 5l5 5-5 5',
  plus: 'M10 4.5v11M4.5 10h11',
  check: 'M5 10.5l3.2 3L15 6.5',
  close: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5zM4 8.5h12M7.5 3.5v3M12.5 3.5v3',
  folder: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h3l1.5 1.5H15a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14z',
  settings:
    'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
  sun: 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1',
  moon: 'M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8z',
  bell: 'M6 8.5a4 4 0 0 1 8 0c0 4 1.5 5 1.5 5h-11S6 12.5 6 8.5zM8.5 16a1.5 1.5 0 0 0 3 0',
  flag: 'M5.5 16.5v-12M5.5 4.5h8l-1.5 3 1.5 3h-8',
  refresh: 'M15.5 8A6 6 0 0 0 4.8 6.5M4.5 12a6 6 0 0 0 10.7 1.5M4.5 3.5v3h3M15.5 16.5v-3h-3',
  play: 'M7 5l8 5-8 5z',
  pause: 'M7 5v10M13 5v10',
  stop: 'M6 6h8v8H6z',
  note: 'M5.5 3.5h6l3 3v10h-9zM11.5 3.5v3h3M7.5 10h5M7.5 13h3',
  location: 'M10 17s5-4.5 5-8.5a5 5 0 0 0-10 0c0 4 5 8.5 5 8.5zM10 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  keyboard:
    'M3 6.5A1.5 1.5 0 0 1 4.5 5h11A1.5 1.5 0 0 1 17 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 13.5zM6 8.5h.01M9 8.5h.01M12 8.5h.01M14 8.5h.01M7 12h6',
  arrowUpRight: 'M7 13l6-6M8 7h5v5',
  sync: 'M4 10a6 6 0 0 1 10.2-4.3L16 7.5M16 10a6 6 0 0 1-10.2 4.3L4 12.5M16 4v3.5h-3.5M4 16v-3.5h3.5',
};

export function icon(name, size = 18) {
  const svg = h('svg', {
    viewBox: '0 0 20 20',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: 'icon',
  });
  svg.append(h('path', { d: PATHS[name] || '' }));
  return svg;
}

/** Icon-only button with an accessible label + tooltip. */
export function iconButton(name, label, onClick, extra = {}) {
  return h(
    'button',
    { type: 'button', class: ['icon-btn', extra.class], 'aria-label': label, title: extra.title ?? label, onClick, ...extra.attrs },
    icon(name, extra.size),
  );
}

export function autosize(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return textarea;
}

/** Wrap a DOM update in a View Transition when supported (calm cross-fades). */
export function transition(update) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) return update();
  document.startViewTransition(update);
}
