// Tasks mode (Figma "Home — Tasks"): a week board, one column per day.
// Add inline under any day, drag a task onto another day to reschedule,
// and open Projects from the header.

import * as store from '../core/store.js';
import { todayKey, weekKeys, addDays, fromKey, weekdayName, formatWeekRange } from '../core/dates.js';
import { h, reactive, transition, tab } from './dom.js';
import { taskList, taskDropTarget, addTaskFromText, enableMultiPaste } from './tasks.js';
import { projectsView } from './projects.js';

const pad = (n) => String(n).padStart(2, '0');

export function shiftWeek(n) {
  transition(() => store.setUI({ date: addDays(store.ui.date, n * 7) }));
}

export function tasksToday() {
  transition(() => store.setUI({ date: todayKey() }));
}

export function setTasksView(view) {
  if (view === 'projects' && !store.getProject(store.ui.projectId)) store.setUI({ projectId: store.projectList()[0]?.id ?? null });
  transition(() => store.setDevice({ tasksView: view }));
}

export function tasksPage() {
  const page = h('section', { class: 'page page--tasks', 'aria-label': 'Tasks' });
  // Rebuild only when the view or week changes; lists inside update on their own,
  // so an open "add task" input keeps focus while tasks appear above it.
  let key = null;
  const render = () => {
    if (key !== null && !page.isConnected) return unsub();
    const view = store.getDevice().tasksView;
    const next = `${view}|${weekKeys(store.ui.date, store.prefs().weekStart)[0]}|${todayKey()}`;
    if (next === key) return;
    key = next;
    page.replaceChildren(header(view), view === 'projects' ? h('div', { class: 'page__body' }, projectsView()) : board());
  };
  const unsub = store.subscribe(render);
  render();
  return page;
}

function header(view) {
  const ws = store.prefs().weekStart;
  const inWeek = view !== 'projects';
  return h(
    'header',
    { class: 'page__head' },
    h('h1', { class: 'page__title' }, inWeek ? 'Tasks' : 'Projects'),
    h(
      'div',
      { class: 'pagenav' },
      inWeek
        ? h(
            'div',
            { class: 'pagenav__left' },
            h(
              'button',
              { type: 'button', class: 'pagenav__arrow', 'aria-label': 'Previous week', title: 'Previous week (←)', onClick: () => shiftWeek(-1) },
              '‹',
            ),
            h('span', { class: 'pagenav__label' }, formatWeekRange(store.ui.date, ws)),
            h('button', { type: 'button', class: 'pagenav__arrow', 'aria-label': 'Next week', title: 'Next week (→)', onClick: () => shiftWeek(1) }, '›'),
            !weekKeys(store.ui.date, ws).includes(todayKey()) &&
              h('button', { type: 'button', class: 'outline-btn', onClick: tasksToday, title: 'This week (T)' }, 'Today'),
          )
        : h(
            'div',
            { class: 'pagenav__left' },
            h('button', { type: 'button', class: 'pagenav__arrow', 'aria-label': 'Back to tasks', onClick: () => setTasksView('week') }, '‹'),
            h('span', { class: 'pagenav__label' }, 'Back to this week'),
          ),
      h(
        'div',
        { class: 'tabs', role: 'tablist', 'aria-label': 'Tasks view' },
        tab('Week', view === 'week', () => setTasksView('week')),
        tab('Projects', view === 'projects', () => setTasksView('projects')),
      ),
    ),
  );
}

function board() {
  const today = todayKey();
  const days = weekKeys(store.ui.date, store.prefs().weekStart);
  const carry = reactive(h('div', { class: 'board__carry' }), () => {
    const earlier = store.carriedOver(today);
    if (!earlier.length) return null;
    return h(
      'div',
      { class: 'carry' },
      h('span', null, `${earlier.length} unfinished from earlier`),
      h('button', { type: 'button', class: 'text-btn', onClick: () => earlier.forEach((t) => store.updateTask(t.id, { date: today })) }, 'Move to today'),
    );
  });
  return h(
    'div',
    { class: 'page__body board-wrap' },
    carry,
    h(
      'div',
      { class: 'board' },
      days.map((key) => dayColumn(key, today)),
    ),
  );
}

function dayColumn(key, today) {
  const d = fromKey(key);
  const list = reactive(h('div', { class: 'board__list' }), () => {
    const tasks = store.tasksForDate(key);
    return tasks.length ? taskList(tasks, { draggable: true, showProject: true }) : null;
  });
  const col = h(
    'section',
    { class: ['board__col', key === today && 'is-today', key < today && 'is-past'], 'aria-label': weekdayName(key), dataset: { date: key } },
    h(
      'header',
      { class: 'board__head' },
      h('span', { class: 'board__weekday' }, key === today ? 'Today' : weekdayName(key)),
      h('span', { class: 'board__num' }, pad(d.getDate())),
    ),
    list,
    addTask(key),
  );

  return taskDropTarget(col, key);
}

/**
 * "+ ADD TASK" that turns into an inline input. It stays open after Enter so
 * you can type several tasks in a row; pasting a list adds one task per line.
 */
export function addTask(key) {
  const wrap = h('div', { class: 'board__add' });
  const button = h(
    'button',
    {
      type: 'button',
      class: 'board__add-btn',
      dataset: { date: key },
      onClick: () => open(),
    },
    '+ Add task',
  );
  const open = () => {
    const input = h('input', { class: 'board__input', placeholder: 'New task', 'aria-label': `New task for ${weekdayName(key)}`, maxlength: '300' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (addTaskFromText(input.value, { date: key })) input.value = '';
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        input.value = '';
        input.blur();
      }
    });
    enableMultiPaste(input, { date: key });
    input.addEventListener('blur', () => {
      if (!input.value.trim()) wrap.replaceChildren(button);
    });
    wrap.replaceChildren(input, h('div', { class: 'composer__hint board__hint' }, 'Enter for the next one · paste a list to add many'));
    input.focus();
  };
  wrap.append(button);
  return wrap;
}

/** Focus the add-task input for a given day (used by the N shortcut). */
export function focusAddTask(key = todayKey()) {
  const btn = document.querySelector(`.board__add-btn[data-date="${key}"]`) || document.querySelector('.board__add-btn');
  btn?.click();
}
