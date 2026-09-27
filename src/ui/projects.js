// Projects: a label that groups tasks and notes. Intentionally not a PM tool —
// no boards, statuses, assignees or due-date math.

import * as store from '../core/store.js';
import { PROJECT_COLORS } from '../core/store.js';
import { todayKey, formatShort } from '../core/dates.js';
import { h, icon, iconButton, reactive, transition } from './dom.js';
import { taskList, taskComposer } from './tasks.js';
import { noteList, noteButton } from './notes.js';
import { openPopover, closeOverlay, toast } from './overlay.js';

const excerpt = (text, n = 140) => {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
};

/** Open a project; `focusTask` puts the cursor in its "Add task" field. */
function openProject(id, { focusTask = false } = {}) {
  transition(() => store.setUI({ projectId: id }), id ? 'next' : 'prev');
  if (!focusTask) return;
  // The page swaps inside a view transition; wait for the field to exist.
  const tryFocus = (n = 0) => {
    const input = document.querySelector('.project .composer__input');
    if (input) input.focus();
    else if (n < 60) requestAnimationFrame(() => tryFocus(n + 1));
  };
  tryFocus();
}

export function projectsView() {
  const root = h('div', { class: 'projects' });
  let shown;
  const render = () => {
    if (shown !== undefined && !root.isConnected) return unsub();
    const project = store.getProject(store.ui.projectId);
    const id = project?.id ?? null;
    if (id === shown) return;
    shown = id;
    root.replaceChildren(project ? projectDetail(project) : projectGrid());
  };
  const unsub = store.subscribe(render);
  render();
  return root;
}

// ---------- overview: one tinted card per project ----------

function projectGrid() {
  const search = h('input', {
    class: 'projects__search-input',
    type: 'search',
    placeholder: 'Search projects, tasks and notes',
    'aria-label': 'Search projects',
    value: store.ui.projectQuery || '',
    onInput: (e) => store.setUI({ projectQuery: e.target.value }),
  });
  const toolbar = h(
    'div',
    { class: 'projects__bar' },
    h('label', { class: 'projects__search' }, icon('search', 16), search),
    h(
      'button',
      { type: 'button', class: 'glass-btn projects__new', onClick: () => document.querySelector('.pcard--new input')?.focus() },
      icon('plus', 16),
      'New project',
    ),
  );

  const grid = reactive(
    h('div', { class: 'pgrid' }),
    () => {
      const q = (store.ui.projectQuery || '').trim().toLowerCase();
      const matches = (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        store.tasksForProject(p.id).some((t) => t.title.toLowerCase().includes(q)) ||
        store.notesForProject(p.id).some((n) => `${n.title} ${n.body}`.toLowerCase().includes(q));
      const projects = store.projectList().filter(matches);
      return [
        ...projects.map(projectCard),
        !q && newProjectCard(),
        q && !projects.length && h('p', { class: 'empty pgrid__none' }, `Nothing matches “${store.ui.projectQuery.trim()}”.`),
      ];
    },
    () => [store.getData().tasks, store.getData().notes, store.getData().projects, store.prefs(), store.ui.projectQuery],
  );

  return h('div', { class: 'projects__overview' }, toolbar, grid);
}

function projectCard(p) {
  const all = store.tasksForProject(p.id);
  const open = all.filter((t) => !t.done);
  const done = all.length - open.length;
  const notes = store.notesForProject(p.id);
  const today = todayKey();
  const dueToday = open.filter((t) => t.date === today).length;
  const note = notes[0];
  const chip = (text, extra) => h('span', { class: ['pchip', extra] }, text);

  return h(
    'article',
    {
      class: 'pcard',
      style: { '--pc': p.color },
      // The whole card opens the project; its own buttons keep their jobs.
      onClick: (e) => !e.target.closest('button, a, input') && openProject(p.id),
    },
    h(
      'header',
      { class: 'pcard__head' },
      h('button', { type: 'button', class: 'pcard__title', onClick: () => openProject(p.id) }, p.name),
      h(
        'div',
        { class: 'pcard__tools' },
        iconButton('plus', `Add a task to ${p.name}`, () => openProject(p.id, { focusTask: true }), { size: 18 }),
        iconButton('more', 'Project options', (e) => projectMenu(e.currentTarget, p), { size: 18 }),
      ),
    ),
    h(
      'div',
      { class: 'pcard__body' },
      h(
        'div',
        { class: 'pcard__chips' },
        chip(open.length ? `${open.length} open` : 'All clear'),
        dueToday > 0 && chip(`${dueToday} today`, 'pchip--today'),
        done > 0 && chip(`${done} done`),
        notes.length > 0 && chip(`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`),
      ),
      open.length
        ? h(
            'ul',
            { class: 'pcard__tasks', role: 'list' },
            open.slice(0, 4).map((t) =>
              h(
                'li',
                { class: 'pcard__task' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'pcard__check',
                    role: 'checkbox',
                    'aria-checked': 'false',
                    'aria-label': `Mark “${t.title}” as done`,
                    onClick: () => store.toggleTask(t.id),
                  },
                  icon('check', 12),
                ),
                h('span', { class: 'pcard__task-title' }, t.title),
                t.date && h('span', { class: ['pcard__due', t.date < today && 'is-late'] }, t.date === today ? 'Today' : formatShort(t.date)),
              ),
            ),
            open.length > 4 && h('li', { class: 'pcard__more' }, `+${open.length - 4} more`),
          )
        : h('p', { class: 'pcard__empty' }, all.length ? 'Everything here is done.' : 'No tasks yet — press + to add one.'),
      note && h('div', { class: 'pcard__note' }, h('mark', null, note.title || 'Untitled note'), note.body && h('p', null, excerpt(note.body))),
    ),
  );
}

/** Last card in the grid: type a name to make a project. */
function newProjectCard() {
  const input = h('input', { class: 'pcard__new-input', placeholder: 'New project', 'aria-label': 'New project name', maxlength: '60' });
  return h(
    'form',
    {
      class: 'pcard pcard--new',
      onClick: () => input.focus(),
      onSubmit: (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        store.findOrCreateProject(name);
        input.value = '';
        input.blur(); // the grid holds re-renders while you type in it
        toast(`“${name}” created`);
      },
    },
    h('span', { class: 'pcard__plus' }, icon('plus', 20)),
    input,
    h('p', { class: 'pcard__hint' }, 'Group related tasks and notes — Work, Travel, Home. Tip: type #name while adding a task.'),
  );
}

// ---------- one project ----------

function projectDetail(project) {
  const header = reactive(h('header', { class: 'project__head' }), () => {
    const p = store.getProject(project.id);
    if (!p) return null;
    const name = h('input', {
      class: 'project__name',
      value: p.name,
      'aria-label': 'Project name',
      maxlength: '60',
      onChange: (e) => e.target.value.trim() && store.updateProject(p.id, { name: e.target.value.trim() }),
      onKeydown: (e) => e.key === 'Enter' && e.target.blur(),
    });
    return [
      h(
        'nav',
        { class: 'crumbs', 'aria-label': 'Breadcrumb' },
        h('button', { type: 'button', class: 'crumbs__back', onClick: () => openProject(null) }, icon('chevronLeft', 16), 'Projects'),
        h('span', { class: 'crumbs__sep', 'aria-hidden': 'true' }, '/'),
        h('span', { class: 'crumbs__here' }, p.name),
      ),
      h(
        'div',
        { class: 'project__title' },
        h('i', { class: 'dot dot--lg', style: { background: p.color } }),
        name,
        iconButton('more', 'Project options', (e) => projectMenu(e.currentTarget, p)),
      ),
    ];
  });

  const tasks = reactive(
    h('div', { class: 'col__body' }),
    () => {
      const list = store.tasksForProject(project.id);
      return list.length ? taskList(list, { showDate: true, showProject: false }) : h('p', { class: 'empty' }, 'No tasks yet.');
    },
    store.taskDeps,
  );
  const notes = reactive(
    h('div', { class: 'col__body' }),
    () => noteList(store.notesForProject(project.id), { showDate: true, showProject: false, empty: 'No notes yet.' }),
    store.noteDeps,
  );

  return h(
    'div',
    { class: 'project', style: { '--pc': project.color } },
    header,
    h(
      'div',
      { class: 'cols cols--two' },
      h(
        'section',
        { class: 'col' },
        h('h2', { class: 'col__title' }, 'Tasks'),
        tasks,
        taskComposer({ placeholder: 'Add task', defaults: () => ({ projectId: project.id, date: null }) }),
      ),
      h(
        'section',
        { class: 'col' },
        h('h2', { class: 'col__title' }, 'Notes'),
        notes,
        noteButton('New note', () => ({ projectId: project.id, date: null })),
      ),
    ),
  );
}

function projectMenu(anchor, project) {
  openPopover(
    anchor,
    h(
      'div',
      { class: 'menu' },
      h('div', { class: 'field__label' }, 'Colour'),
      h(
        'div',
        { class: 'swatches' },
        PROJECT_COLORS.map((c) =>
          h('button', {
            type: 'button',
            class: ['swatch', c === project.color && 'is-active'],
            style: { background: c },
            'aria-label': `Colour ${c}`,
            onClick: () => (closeOverlay(), store.updateProject(project.id, { color: c })),
          }),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'menu__item text-btn--danger',
          onClick: () => {
            closeOverlay();
            store.deleteProject(project.id);
            store.setUI({ projectId: null });
            toast(`“${project.name}” deleted. Its tasks and notes were kept.`);
          },
        },
        'Delete project',
      ),
    ),
    { align: 'end' },
  );
}
