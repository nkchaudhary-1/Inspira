// Experience modes. The switcher is four quiet words at the bottom edge —
// deliberately not a nav bar.

import * as store from '../core/store.js';
import { h, reactive, transition } from './dom.js';

export const MODES = [
  { id: 'clock', label: 'Clock', key: '1' },
  { id: 'motivation', label: 'Motivation', key: '2' },
  { id: 'focus', label: 'Focus', key: '3' },
  { id: 'plan', label: 'Plan', key: '4' },
];

let renderStage = () => {};
let renderedMode = null;

export function registerStage(fn) {
  renderStage = (mode) => {
    renderedMode = mode;
    fn(mode);
  };
  // Another tab may change the device mode; follow it only when idle here.
  store.subscribe(() => {
    const mode = store.getDevice().mode;
    if (mode !== renderedMode && !document.hasFocus()) renderStage(mode);
  });
}

export function setMode(mode) {
  if (!MODES.some((m) => m.id === mode)) return;
  if (mode === renderedMode) return;
  transition(() => {
    store.setDevice({ mode });
    renderStage(mode);
  });
}

export const currentMode = () => renderedMode;

export function modeSwitcher() {
  return reactive(h('nav', { class: 'modes', 'aria-label': 'View' }), () => {
    const mode = renderedMode || store.getDevice().mode;
    return MODES.map((m) =>
      h(
        'button',
        {
          type: 'button',
          class: ['modes__item', m.id === mode && 'is-active'],
          'aria-current': m.id === mode ? 'page' : null,
          title: `${m.label} (${m.key})`,
          onClick: () => setMode(m.id),
        },
        m.label,
      ),
    );
  });
}
