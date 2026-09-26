// Plan mode: the daily workspace. The date is the backbone — Schedule, Tasks
// and Notes are three separate columns so scheduled / to-do / remember never blur.

import * as store from '../core/store.js';
import { todayKey, addDays, formatShort, formatLong, relativeLabel } from '../core/dates.js';
import { loadMonth } from '../services/calendar.js';
import { h, icon, iconButton, reactive, transition } from './dom.js';
import { taskList, taskComposer } from './tasks.js';
import { noteList, noteButton, closeNote } from './notes.js';
import { eventList } from './schedule.js';
import { openCalendar } from './calendar.js';
import { projectsView } from './projects.js';

export function goToDate(key) {
  closeNote();
  transition(() => store.setUI({ date: key, view: 'day' }));
  loadMonth(key);
}

export const shiftDay = (n) => goToDate(addDays(store.ui.date, n));

export function workspace() {
  const nav = reactive(h('div', { class: 'daynav-wrap' }), () => (store.ui.view === 'projects' ? projectsHeader() : dayNav()));
  const body = h('div', { class: 'workspace__body' });

  // Swap the body only when view/date changes so composers keep their DOM.
  let key = null;
  const renderBody = () => {
    const next = `${store.ui.view}:${store.ui.view === 'day' ? store.ui.date : ''}`;
    if (next === key && body.isConnected) return;
    if (key !== null && !body.isConnected) return unsub();
    key = next;
    body.replaceChildren(store.ui.view === 'projects' ? projectsView() : dayColumns());
  };
  const unsub = store.subscribe(renderBody);
  renderBody();
  loadMonth(store.ui.date);

  return h('section', { class: 'workspace', 'aria-label': 'Daily workspace' }, nav, body);
}

function dayNav() {
  const date = store.ui.date;
  const today = todayKey();
  const rel = relativeLabel(date, today);
  const title = h(
    'button',
    { type: 'button', class: 'daynav__title', title: 'Open calendar (C)', id: 'daynav-title', onClick: (e) => openCalendar(e.currentTarget, goToDate) },
    h('span', { class: 'daynav__date' }, formatLong(date)),
  );
  return h(
    'nav',
    { class: 'daynav', 'aria-label': 'Date' },
    h(
      'button',
      { type: 'button', class: 'daynav__step', onClick: () => shiftDay(-1), title: 'Previous day (←)' },
      icon('chevronLeft', 16),
      h('span', null, formatShort(addDays(date, -1))),
    ),
    h(
      'div',
      { class: 'daynav__center' },
      title,
      date === today
        ? h('span', { class: 'eyebrow daynav__rel' }, 'Today')
        : h(
            'button',
            { type: 'button', class: 'eyebrow daynav__rel daynav__back', onClick: () => goToDate(today), title: 'Jump to today (T)' },
            rel ? `${rel}  ·  Back to today` : 'Back to today',
          ),
    ),
    h(
      'div',
      { class: 'daynav__end' },
      h(
        'button',
        { type: 'button', class: 'daynav__step', onClick: () => shiftDay(1), title: 'Next day (→)' },
        h('span', null, formatShort(addDays(date, 1))),
        icon('chevronRight', 16),
      ),
      h(
        'div',
        { class: 'daynav__tools' },
        iconButton('calendar', 'Calendar (C)', (e) => openCalendar(e.currentTarget, goToDate)),
        iconButton('folder', 'Projects (P)', () => openProjects()),
      ),
    ),
  );
}

function projectsHeader() {
  return h(
    'nav',
    { class: 'daynav daynav--projects' },
    h(
      'button',
      { type: 'button', class: 'daynav__step', onClick: () => store.setUI({ view: 'day' }) },
      icon('chevronLeft', 16),
      h('span', null, formatShort(store.ui.date)),
    ),
    h('div', { class: 'daynav__center' }, h('span', { class: 'daynav__date' }, 'Projects')),
    h('span', null),
  );
}

export function openProjects(projectId) {
  closeNote();
  transition(() => store.setUI({ view: 'projects', projectId: projectId ?? store.ui.projectId ?? store.projectList()[0]?.id ?? null }));
}

function column(title, reactiveBody, footer, extraClass) {
  return h('section', { class: ['col', extraClass] }, h('h2', { class: 'col__title' }, title), reactiveBody, footer);
}

function dayColumns() {
  const date = store.ui.date;

  const schedule = reactive(h('div', { class: 'col__body' }), () => eventList(date));

  const tasks = reactive(h('div', { class: 'col__body' }), () => {
    const list = store.tasksForDate(date);
    const earlier = date === todayKey() ? store.carriedOver(date) : [];
    return [
      earlier.length > 0 &&
        h(
          'div',
          { class: 'carry' },
          h('span', null, `${earlier.length} unfinished from earlier`),
          h('button', { type: 'button', class: 'text-btn', onClick: () => earlier.forEach((t) => store.updateTask(t.id, { date })) }, 'Move to today'),
        ),
      list.length ? taskList(list) : h('p', { class: 'empty' }, date < todayKey() ? 'No tasks this day.' : 'Nothing planned yet.'),
    ];
  });

  const notes = reactive(h('div', { class: 'col__body' }), () => noteList(store.notesForDate(date), { empty: 'Capture a thought for this day.' }));

  return h(
    'div',
    { class: 'cols' },
    column('Schedule', schedule, null, 'col--schedule'),
    column('Tasks', tasks, taskComposer({ placeholder: 'Add task', id: 'plan-composer', defaults: () => ({ date: store.ui.date }) }), 'col--tasks'),
    column(
      'Notes',
      notes,
      noteButton('New note', () => ({ date: store.ui.date })),
      'col--notes',
    ),
  );
}
