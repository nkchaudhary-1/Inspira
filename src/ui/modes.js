// Experience modes. Switched from the hidden dock (see dock.js) or keys 1–4.

import * as store from '../core/store.js';
import { transition } from './dom.js';

export const MODES = [
  { id: 'clock', label: 'Clock', key: '1', icon: 'clock' },
  { id: 'motivation', label: 'Motivation', key: '2', icon: 'sparkle' },
  { id: 'focus', label: 'Focus', key: '3', icon: 'target' },
  { id: 'plan', label: 'Plan', key: '4', icon: 'checklist' },
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
