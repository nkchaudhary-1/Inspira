// Tasks: things I need to do. Fast capture (type + Enter), optional details
// tucked behind a "⋯" popover so the list itself stays quiet.

import * as store from '../core/store.js';
import { parseQuickAdd } from '../core/quickadd.js';
import { formatTime, formatShort, todayKey, addDays } from '../core/dates.js';
import { h, icon, iconButton } from './dom.js';
import { openPopover, closeOverlay, toast } from './overlay.js';

const PRIORITY = ['None', 'Low', 'Medium', 'High'];

/** Drag payload type for moving tasks between days. */
export const TASK_MIME = 'application/x-inspira-task';

export function taskList(tasks, { showDate = false, showProject = true, compact = false, draggable = false, limit } = {}) {
  const list = limit ? tasks.slice(0, limit) : tasks;
  return h(
    'ul',
    { class: ['task-list', compact && 'task-list--compact'], role: 'list' },
    list.map((t) => taskRow(t, { showDate, showProject, compact, draggable })),
  );
}

function taskRow(task, { showDate, showProject, compact, draggable }) {
  const prefs = store.prefs();
  const project = showProject ? store.getProject(task.projectId) : null;
  const meta = [
    showDate && task.date && h('span', { class: 'meta' }, formatShort(task.date)),
    task.time && h('span', { class: 'meta' }, formatTime(task.time, prefs.clock24)),
    project && h('span', { class: 'meta meta--project' }, h('i', { class: 'dot', style: { background: project.color } }), project.name),
    task.priority > 0 && !compact && h('span', { class: `meta meta--p${task.priority}`, title: `${PRIORITY[task.priority]} priority` }, icon('flag', 12)),
    task.reminder && !task.done && h('span', { class: 'meta', title: 'Reminder set' }, icon('bell', 12)),
  ].filter(Boolean);

  const title = h('span', { class: 'task__title', tabindex: '0', role: 'button', 'aria-label': `Edit “${task.title}”` }, task.title);
  const startEdit = () => editTitle(title, task);
  title.addEventListener('click', startEdit);
  title.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), startEdit()));

  return h(
    'li',
    {
      class: ['task', Date.now() - task.createdAt < 600 && 'is-new', task.done && 'is-done', task.priority && `task--p${task.priority}`],
      dataset: { id: task.id },
      draggable: draggable ? 'true' : null,
      onDragstart: draggable
        ? (e) => {
            e.dataTransfer.setData(TASK_MIME, task.id);
            e.dataTransfer.effectAllowed = 'move';
            e.currentTarget.classList.add('is-dragging');
          }
        : null,
      onDragend: draggable ? (e) => e.currentTarget.classList.remove('is-dragging') : null,
    },
    h(
      'button',
      {
        type: 'button',
        class: 'task__check',
        role: 'checkbox',
        'aria-checked': String(task.done),
        'aria-label': task.done ? 'Mark as not done' : 'Mark as done',
        onClick: () => store.toggleTask(task.id),
      },
      icon('check', 14),
    ),
    h('div', { class: 'task__body' }, title, meta.length ? h('div', { class: 'task__meta' }, meta) : null),
    iconButton('more', 'Task details', (e) => openTaskMenu(e.currentTarget, task.id), { class: 'task__more', size: 16 }),
  );
}

/** Let `el` accept dropped tasks and move them to day `key`. */
export function taskDropTarget(el, key) {
  el.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(TASK_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('is-drop');
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('is-drop');
  });
  el.addEventListener('drop', (e) => {
    el.classList.remove('is-drop');
    const id = e.dataTransfer.getData(TASK_MIME);
    if (!id) return;
    e.preventDefault();
    const task = store.getData().tasks[id];
    if (task && task.date !== key) store.updateTask(id, { date: key });
  });
  return el;
}

function editTitle(titleEl, task) {
  const input = h('input', { class: 'task__edit', value: task.title, 'aria-label': 'Task title', maxlength: '300' });
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    input.blur();
    if (!save || value === task.title) return input.replaceWith(titleEl);
    if (!value) return removeTask(task.id);
    store.updateTask(task.id, { title: value });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  titleEl.replaceWith(input);
  input.focus();
  input.select();
}

export function removeTask(id) {
  store.deleteTask(id);
  toast('Task deleted', { label: 'Undo', run: () => store.updateTask(id, { deleted: false }) });
}

/**
 * Quick-add input. Lives outside reactive regions so it keeps focus while the
 * list above re-renders. `defaults()` returns fields for new tasks.
 */
export function taskComposer({ placeholder = 'Add task', defaults = () => ({}), id } = {}) {
  const input = h('input', {
    class: 'composer__input',
    placeholder,
    'aria-label': placeholder,
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: '300',
    id,
  });
  const hint = h('div', { class: 'composer__hint' }, '#project  ·  ! priority  ·  @6pm time  ·  Enter to add');
  const form = h('form', { class: 'composer' }, h('span', { class: 'composer__plus' }, icon('plus', 16)), input, hint);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseQuickAdd(input.value);
    if (!parsed.title) return;
    const fields = { ...defaults(), title: parsed.title };
    if (parsed.priority) fields.priority = parsed.priority;
    if (parsed.time) fields.time = parsed.time;
    if (parsed.project) fields.projectId = store.findOrCreateProject(parsed.project).id;
    store.addTask(fields);
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
      e.stopPropagation();
    }
  });
  return form;
}

// ---------- details popover ----------

function requestNotifications() {
  // Must run synchronously inside the user gesture.
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return Promise.resolve(false);
  return chrome.permissions.request({ permissions: ['notifications'] }).catch(() => false);
}

function toLocalInput(ms) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function openTaskMenu(anchor, id) {
  const render = () => {
    const task = store.getData().tasks[id];
    if (!task || task.deleted) return closeOverlay();
    const today = todayKey();
    const projects = store.projectList();

    const dateInput = h('input', { type: 'date', class: 'field__input', value: task.date || '', onChange: (e) => update({ date: e.target.value || null }) });
    const timeInput = h('input', { type: 'time', class: 'field__input', value: task.time || '', onChange: (e) => update({ time: e.target.value || null }) });

    const projectSelect = h(
      'select',
      {
        class: 'field__input',
        onChange: (e) => {
          const v = e.target.value;
          if (v !== '__new') return update({ projectId: v || null });
          // Inline "new project" input replaces the select.
          const input = h('input', { class: 'field__input', placeholder: 'Project name', maxlength: '60' });
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && input.value.trim()) update({ projectId: store.findOrCreateProject(input.value).id });
            if (ev.key === 'Escape') {
              ev.stopPropagation();
              refresh();
            }
          });
          e.target.replaceWith(input);
          input.focus();
        },
      },
      h('option', { value: '' }, 'No project'),
      projects.map((p) => h('option', { value: p.id, selected: p.id === task.projectId }, p.name)),
      h('option', { value: '__new' }, 'New project…'),
    );

    const reminderInput = h('input', {
      type: 'datetime-local',
      class: 'field__input',
      value: task.reminder ? toLocalInput(task.reminder) : '',
      onChange: (e) => {
        const value = e.target.value;
        if (value) requestNotifications();
        update({ reminder: value ? new Date(value).getTime() : null });
      },
    });

    const atTaskTime =
      task.date && task.time
        ? h(
            'button',
            {
              type: 'button',
              class: 'chip',
              onClick: () => {
                requestNotifications();
                const [y, m, d] = task.date.split('-').map(Number);
                const [hh, mm] = task.time.split(':').map(Number);
                update({ reminder: new Date(y, m - 1, d, hh, mm).getTime() });
              },
            },
            'At task time',
          )
        : null;

    return h(
      'div',
      { class: 'task-menu' },
      h('div', { class: 'task-menu__title' }, task.title),
      field(
        'Date',
        h(
          'div',
          { class: 'field__row' },
          dateInput,
          chip('Today', () => update({ date: today }), task.date === today),
          chip('Tomorrow', () => update({ date: addDays(today, 1) }), task.date === addDays(today, 1)),
        ),
      ),
      field('Time', h('div', { class: 'field__row' }, timeInput, task.time && chip('Clear', () => update({ time: null })))),
      field(
        'Priority',
        h(
          'div',
          { class: 'segmented', role: 'radiogroup' },
          PRIORITY.map((label, i) =>
            h(
              'button',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': String(task.priority === i),
                class: ['segmented__opt', task.priority === i && 'is-active'],
                onClick: () => update({ priority: i }),
              },
              label,
            ),
          ),
        ),
      ),
      field('Project', projectSelect),
      field('Reminder', h('div', { class: 'field__row' }, reminderInput, atTaskTime, task.reminder && chip('Clear', () => update({ reminder: null })))),
      h(
        'div',
        { class: 'task-menu__foot' },
        h('button', { type: 'button', class: 'text-btn', onClick: () => store.toggleTask(id) || refresh() }, task.done ? 'Mark as not done' : 'Mark as done'),
        h('button', { type: 'button', class: 'text-btn text-btn--danger', onClick: () => (closeOverlay(), removeTask(id)) }, 'Delete'),
      ),
    );
  };

  let pop;
  const refresh = () => pop?.replaceChildren(render());
  const update = (patch) => {
    store.updateTask(id, patch);
    refresh();
  };
  pop = openPopover(anchor, render(), { align: 'end', className: 'popover--menu' });
}

function field(label, control) {
  return h('div', { class: 'field' }, h('span', { class: 'field__label' }, label), control);
}

function chip(label, onClick, active) {
  return h('button', { type: 'button', class: ['chip', active && 'is-active'], onClick }, label);
}
