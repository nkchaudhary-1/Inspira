// The quiet "Today" rail beside the clock. Secondary by design: low contrast
// until hovered, a handful of items, one-line capture.

import * as store from '../core/store.js';
import { todayKey, formatShort } from '../core/dates.js';
import { h, reactive } from './dom.js';
import { taskList, taskComposer } from './tasks.js';
import { eventList } from './schedule.js';
import { setMode } from './modes.js';

const LIMIT = 6;

export function rail() {
  const body = reactive(h('div', { class: 'rail__body' }), () => {
    const today = todayKey();
    const tasks = store.tasksForDate(today);
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const shown = [...open.slice(0, LIMIT), ...done.slice(0, Math.max(0, LIMIT - open.length))];
    const hidden = tasks.length - shown.length;
    const events = eventList(today, { upcomingOnly: true, limit: 3, compact: true });
    return [
      events && h('div', { class: 'rail__group' }, events),
      shown.length ? taskList(shown, { compact: true, showProject: false }) : !events && h('p', { class: 'empty' }, 'A clear day. Add what matters.'),
      hidden > 0 && h('button', { type: 'button', class: 'text-btn rail__more', onClick: () => openToday() }, `${hidden} more`),
    ];
  });

  return h(
    'aside',
    { class: 'rail', 'aria-label': 'Today' },
    h(
      'header',
      { class: 'rail__head' },
      h('button', { type: 'button', class: 'rail__title', onClick: openToday, title: 'Open planning (4)' }, 'Today'),
      h('span', { class: 'rail__date' }, formatShort(todayKey())),
    ),
    body,
    taskComposer({ placeholder: 'Add', id: 'rail-composer', defaults: () => ({ date: todayKey() }) }),
  );
}

function openToday() {
  store.setUI({ date: todayKey(), view: 'day' });
  setMode('plan');
}
