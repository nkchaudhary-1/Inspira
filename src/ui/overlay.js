// Popovers, sheets and toasts. One overlay at a time keeps the page calm.

import { h } from './dom.js';

let current = null;

export function closeOverlay() {
  if (!current) return false;
  const { el, onClose, restoreFocus } = current;
  current = null;
  el.classList.add('is-leaving');
  setTimeout(() => el.remove(), 160);
  onClose?.();
  restoreFocus?.focus?.({ preventScroll: true });
  return true;
}

export const overlayOpen = () => Boolean(current);

/**
 * Anchored popover. `anchor` is the element it points at; content is a node.
 * Closes on outside click and Escape (Escape is handled by shortcuts.js).
 */
export function openPopover(anchor, content, { onClose, align = 'start', className } = {}) {
  closeOverlay();
  const el = h('div', { class: ['popover', className], role: 'dialog' }, content);
  document.body.append(el);
  position(el, anchor, align);
  current = { el, onClose, restoreFocus: document.activeElement };
  setTimeout(() => {
    const onDown = (e) => {
      if (!current || current.el !== el) return document.removeEventListener('pointerdown', onDown, true);
      if (!el.contains(e.target) && !anchor.contains(e.target)) {
        document.removeEventListener('pointerdown', onDown, true);
        closeOverlay();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
  });
  const first = el.querySelector('[autofocus], input, button, select, textarea');
  first?.focus({ preventScroll: true });
  return el;
}

function position(el, anchor, align) {
  const r = anchor.getBoundingClientRect();
  const pad = 12;
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  let left = align === 'end' ? r.right - w : align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  let top = r.bottom + 8;
  if (top + hgt > window.innerHeight - pad) top = Math.max(pad, r.top - hgt - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/** Side sheet (settings, shortcuts). */
export function openSheet(title, content, { onClose } = {}) {
  closeOverlay();
  const el = h(
    'div',
    { class: 'sheet-layer' },
    h('div', { class: 'sheet-scrim', onClick: () => closeOverlay() }),
    h(
      'aside',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h(
        'header',
        { class: 'sheet__head' },
        h('h2', { class: 'sheet__title' }, title),
        h('button', { type: 'button', class: 'text-btn', onClick: () => closeOverlay() }, 'Done'),
      ),
      h('div', { class: 'sheet__body' }, content),
    ),
  );
  document.body.append(el);
  current = { el, onClose, restoreFocus: document.activeElement };
  el.querySelector('.sheet')?.focus?.();
  return el;
}

let toastTimer = null;
export function toast(message, action) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h(
    'div',
    { class: 'toast', role: 'status' },
    h('span', null, message),
    action &&
      h(
        'button',
        {
          type: 'button',
          class: 'text-btn',
          onClick: () => {
            action.run();
            el.remove();
          },
        },
        action.label,
      ),
  );
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), action ? 6000 : 3000);
}
