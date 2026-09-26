// Calendar mode (Figma "Home — Calendar"). One header, four views:
//   Day   — the daily workspace: Schedule · Tasks · Notes (formerly Plan mode)
//   Week  — seven columns of events + tasks; drag tasks between days
//   Month — the Figma grid: big day numbers, events and tasks in each cell
//   Year  — twelve small months for orientation; click to drill in

import * as store from '../core/store.js';
import {
  todayKey,
  addDays,
  addMonths,
  addYears,
  fromKey,
  toKey,
  monthMatrix,
  weekKeys,
  weekdayInitials,
  weekdayName,
  monthName,
  formatFull,
  formatDayMonthYear,
  formatWeekRange,
  formatMonthYear,
  formatTime,
} from '../core/dates.js';
import { loadMonth } from '../services/calendar.js';
import { h, reactive, transition, tab } from './dom.js';
import { taskList, taskComposer, taskDropTarget } from './tasks.js';
import { noteList, noteButton, closeNote } from './notes.js';
import { eventList } from './schedule.js';

const pad = (n) => String(n).padStart(2, '0');
const VIEWS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
];

const view = () => store.getDevice().calView || 'month';

export function setCalView(next) {
  if (next === view()) return;
  closeNote();
  transition(() => store.setDevice({ calView: next }));
}

/** Open a specific day in Day view. */
export function openDay(key) {
  closeNote();
  transition(() => {
    store.setUI({ date: key });
    store.setDevice({ calView: 'day' });
  });
  loadMonth(key);
}

/** ← / → : step by the current view's unit. */
export function shiftCalendar(dir) {
  const v = view();
  const d = store.ui.date;
  const next = v === 'day' ? addDays(d, dir) : v === 'week' ? addDays(d, dir * 7) : v === 'month' ? addMonths(d, dir) : addYears(d, dir);
  closeNote();
  transition(() => store.setUI({ date: next }));
  loadMonth(next);
}

export function calendarToday() {
  closeNote();
  transition(() => store.setUI({ date: todayKey() }));
  loadMonth(todayKey());
}

function periodLabel(v, d) {
  if (v === 'day') return formatDayMonthYear(d);
  if (v === 'week') return formatWeekRange(d, store.prefs().weekStart);
  if (v === 'month') return formatMonthYear(d);
  return String(fromKey(d).getFullYear());
}

export function calendarPage() {
  const page = h('section', { class: 'page page--calendar', 'aria-label': 'Calendar' });
  // Rebuild when view, period or selected day changes; inner regions are reactive.
  let key = null;
  const render = () => {
    if (key !== null && !page.isConnected) return unsub();
    const v = view();
    const d = store.ui.date;
    const next = `${v}|${d}|${todayKey()}|${store.prefs().weekStart}`;
    if (next === key) return;
    key = next;
    page.replaceChildren(header(v, d), h('div', { class: `page__body cal-view cal-view--${v}` }, body(v, d)));
  };
  const unsub = store.subscribe(render);
  render();
  loadMonth(store.ui.date);
  if (view() === 'week') loadMonth(weekKeys(store.ui.date, store.prefs().weekStart)[6]);
  return page;
}

function header(v, d) {
  return h(
    'header',
    { class: 'page__head' },
    h('h1', { class: 'page__title' }, formatFull(d)),
    h(
      'div',
      { class: 'pagenav' },
      h(
        'div',
        { class: 'pagenav__left' },
        h(
          'button',
          { type: 'button', class: 'pagenav__arrow', 'aria-label': `Previous ${v}`, title: `Previous ${v} (←)`, onClick: () => shiftCalendar(-1) },
          '‹',
        ),
        h('span', { class: 'pagenav__label' }, periodLabel(v, d)),
        h('button', { type: 'button', class: 'pagenav__arrow', 'aria-label': `Next ${v}`, title: `Next ${v} (→)`, onClick: () => shiftCalendar(1) }, '›'),
        h('button', { type: 'button', class: 'outline-btn', onClick: calendarToday, title: 'Today (T)' }, 'Today'),
      ),
      h(
        'div',
        { class: 'tabs', role: 'tablist', 'aria-label': 'Calendar view' },
        VIEWS.map(([id, label]) => tab(label, id === v, () => setCalView(id))),
      ),
    ),
  );
}

function body(v, d) {
  if (v === 'day') return dayView(d);
  if (v === 'week') return weekView(d);
  if (v === 'year') return yearView(d);
  return monthView(d);
}

// ---------- month ----------

const MAX_ITEMS = 4;

/** Events first (they're fixed in time), then open tasks, then done tasks. */
function dayItems(key) {
  const h24 = store.prefs().clock24;
  const events = (store.ui.events[key] || []).map((e) => ({
    kind: 'event',
    text: e.title,
    time: e.allDay ? null : formatTime(new Date(e.start), h24),
    color: e.color,
  }));
  const tasks = store.tasksForDate(key).map((t) => ({ kind: 'task', text: t.title, done: t.done }));
  return [...events, ...tasks];
}

function monthView(d) {
  const date = fromKey(d);
  const month = date.getMonth();
  const ws = store.prefs().weekStart;
  const today = todayKey();
  // Drop a trailing week that belongs entirely to the next month.
  const weeks = monthMatrix(date.getFullYear(), month, ws).filter((week, i) => i < 5 || fromKey(week[0]).getMonth() === month);

  const grid = reactive(h('div', { class: 'month__grid', role: 'grid', style: { gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` } }), () =>
    weeks.flat().map((key, i) => {
      const day = fromKey(key);
      const items = dayItems(key);
      const shown = items.slice(0, MAX_ITEMS);
      const more = items.length - shown.length;
      const notes = store.notesForDate(key).length;
      return h(
        'button',
        {
          type: 'button',
          role: 'gridcell',
          class: ['month__cell', day.getMonth() !== month && 'is-outside', key === today && 'is-today', key === d && 'is-selected'],
          'aria-label': `${formatFull(key)}${items.length ? `, ${items.length} items` : ''}`,
          dataset: { date: key },
          tabindex: key === d ? '0' : '-1',
          onClick: () => openDay(key),
        },
        i < 7 && h('span', { class: 'month__weekday' }, weekdayName(key)),
        h('span', { class: 'month__num' }, pad(day.getDate())),
        h(
          'span',
          { class: 'month__items' },
          shown.map((it) =>
            h(
              'span',
              { class: ['month__item', `month__item--${it.kind}`, it.done && 'is-done'] },
              it.kind === 'event' && h('i', { class: 'month__bar', style: it.color ? { background: it.color } : null }),
              it.time && h('b', null, `${it.time} `),
              it.text,
            ),
          ),
          more > 0 && h('span', { class: 'month__more' }, `+${more} more`),
          notes > 0 && h('span', { class: 'month__more' }, `${notes} note${notes > 1 ? 's' : ''}`),
        ),
      );
    }),
  );

  // Arrow keys move between days inside the grid; Enter opens the day.
  grid.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!moves[e.key]) return;
    const cell = e.target.closest('.month__cell');
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    const target = addDays(cell.dataset.date, moves[e.key]);
    const next = grid.querySelector(`[data-date="${target}"]`);
    if (next) next.focus();
    else {
      transition(() => store.setUI({ date: target }));
      requestAnimationFrame(() => document.querySelector(`.month__cell[data-date="${target}"]`)?.focus());
    }
  });

  return [
    h(
      'div',
      { class: 'month__dow', 'aria-hidden': 'true' },
      weekdayInitials(ws).map((w) => h('span', null, w.toUpperCase())),
    ),
    grid,
  ];
}

// ---------- week ----------

function weekView(d) {
  const today = todayKey();
  const h24 = store.prefs().clock24;
  return h(
    'div',
    { class: 'board board--calendar' },
    weekKeys(d, store.prefs().weekStart).map((key) => {
      const day = fromKey(key);
      const content = reactive(h('div', { class: 'board__list' }), () => {
        const events = store.ui.events[key] || [];
        const tasks = store.tasksForDate(key);
        return [
          events.length > 0 &&
            h(
              'ul',
              { class: 'week__events', role: 'list' },
              events.map((ev) =>
                h(
                  'li',
                  { class: 'week__event' },
                  h('i', { class: 'month__bar', style: ev.color ? { background: ev.color } : null }),
                  h('span', { class: 'week__time' }, ev.allDay ? 'All day' : formatTime(new Date(ev.start), h24)),
                  h('span', { class: 'week__title' }, ev.title),
                ),
              ),
            ),
          tasks.length > 0 && taskList(tasks, { draggable: true, compact: true, showProject: false }),
          !events.length && !tasks.length && h('p', { class: 'empty' }, '—'),
        ];
      });
      return taskDropTarget(
        h(
          'section',
          { class: ['board__col', key === today && 'is-today', key < today && 'is-past'], dataset: { date: key } },
          h(
            'button',
            { type: 'button', class: 'board__head board__head--link', onClick: () => openDay(key), title: 'Open day' },
            h('span', { class: 'board__weekday' }, key === today ? 'Today' : weekdayName(key)),
            h('span', { class: 'board__num' }, pad(day.getDate())),
          ),
          content,
        ),
        key,
      );
    }),
  );
}

// ---------- year ----------

function yearView(d) {
  const year = fromKey(d).getFullYear();
  const ws = store.prefs().weekStart;
  const today = todayKey();
  return reactive(h('div', { class: 'year' }), () => {
    const busy = store.daysWithItems();
    return Array.from({ length: 12 }, (_, m) => {
      const first = toKey(new Date(year, m, 1));
      return h(
        'section',
        { class: 'year__month' },
        h(
          'button',
          {
            type: 'button',
            class: 'year__name',
            onClick: () =>
              transition(() => {
                store.setUI({ date: first });
                store.setDevice({ calView: 'month' });
              }),
          },
          monthName(m),
        ),
        h(
          'div',
          { class: 'year__grid' },
          weekdayInitials(ws).map((w) => h('span', { class: 'year__dow' }, w[0])),
          monthMatrix(year, m, ws)
            .flat()
            .map((key) => {
              const inMonth = fromKey(key).getMonth() === m;
              if (!inMonth) return h('span', { class: 'year__day is-outside' });
              return h(
                'button',
                {
                  type: 'button',
                  class: ['year__day', key === today && 'is-today', busy.has(key) && 'has-items', (store.ui.events[key] || []).length && 'has-events'],
                  'aria-label': formatFull(key),
                  onClick: () => openDay(key),
                },
                fromKey(key).getDate(),
              );
            }),
        ),
      );
    });
  });
}

// ---------- day (the daily workspace) ----------

function column(title, reactiveBody, footer, extraClass) {
  return h('section', { class: ['col', extraClass] }, h('h2', { class: 'col__title' }, title), reactiveBody, footer);
}

function dayView(date) {
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
    column('Tasks', tasks, taskComposer({ placeholder: 'Add task', id: 'day-composer', defaults: () => ({ date: store.ui.date }) }), 'col--tasks'),
    column(
      'Notes',
      notes,
      noteButton('New note', () => ({ date: store.ui.date })),
      'col--notes',
    ),
  );
}
