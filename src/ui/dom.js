// Minimal DOM toolkit: `h` builds elements, `reactive` re-renders a region on
// store changes without stealing focus from an input the user is typing in.

import { subscribe } from '../core/store.js';

export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
      else if (key === 'style' && typeof value === 'object') {
        // Custom properties (--x) need setProperty; Object.assign drops them.
        for (const [prop, v] of Object.entries(value)) prop.startsWith('--') ? el.style.setProperty(prop, v) : (el.style[prop] = v);
      } else if (key === 'dataset') Object.assign(el.dataset, value);
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

const sameDeps = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Render `render()` into `container` now and on every store change. While the
 * user is typing inside the container, re-render is deferred until focus leaves.
 *
 * `deps` (optional) returns the values the region shows — store slices are
 * replaced, never mutated, so references are enough. When they are unchanged
 * the region is left alone instead of being rebuilt on every store change.
 */
export function reactive(container, render, deps) {
  let dirty = false;
  let last = null;
  const run = () => {
    if (!container.isConnected && container.dataset.mounted) return unsubscribe();
    const next = deps?.();
    if (next && sameDeps(last, next)) return;
    const active = document.activeElement;
    if (active && container.contains(active) && isEditing(active)) {
      dirty = true;
      return;
    }
    dirty = false;
    last = next;
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
  chevronLeft: 'M12.5 5l-5 5 5 5',
  chevronRight: 'M7.5 5l5 5-5 5',
  plus: 'M10 4.5v11M4.5 10h11',
  check: 'M5 10.5l3.2 3L15 6.5',
  close: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  trash: 'M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6M8.5 9v4.5M11.5 9v4.5',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5zM4 8.5h12M7.5 3.5v3M12.5 3.5v3',
  folder: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h3l1.5 1.5H15a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14z',
  bell: 'M6 8.5a4 4 0 0 1 8 0c0 4 1.5 5 1.5 5h-11S6 12.5 6 8.5zM8.5 16a1.5 1.5 0 0 0 3 0',
  flag: 'M5.5 16.5v-12M5.5 4.5h8l-1.5 3 1.5 3h-8',
  refresh: 'M15.5 8A6 6 0 0 0 4.8 6.5M4.5 12a6 6 0 0 0 10.7 1.5M4.5 3.5v3h3M15.5 16.5v-3h-3',
  play: 'M7 5l8 5-8 5z',
  pause: 'M7 5v10M13 5v10',
  stop: 'M6 6h8v8H6z',
  note: 'M5.5 3.5h6l3 3v10h-9zM11.5 3.5v3h3M7.5 10h5M7.5 13h3',
  location: 'M10 17s5-4.5 5-8.5a5 5 0 0 0-10 0c0 4 5 8.5 5 8.5zM10 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  arrowUpRight: 'M7 13l6-6M8 7h5v5',
  search: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM13.8 13.8 17 17',
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

/** Segmented-control tab (Calendar views, Tasks views). */
export function tab(label, active, onClick) {
  return h('button', { type: 'button', role: 'tab', 'aria-selected': String(active), class: ['tabs__tab', active && 'is-active'], onClick }, label);
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
/**
 * Swap the page with a View Transition. Only the stage animates (the sky, dock
 * and timer stay put); `dir` ('next' | 'prev') slides it the way you moved.
 */
export function transition(update, dir = 'fade') {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) return update();
  const root = document.documentElement;
  root.dataset.vt = dir;
  const t = document.startViewTransition(update);
  t.finished.finally(() => root.dataset.vt === dir && delete root.dataset.vt);
}
