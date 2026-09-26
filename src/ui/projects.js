// Projects: a label that groups tasks and notes. Intentionally not a PM tool —
// no boards, statuses, assignees or due-date math.

import * as store from '../core/store.js';
import { PROJECT_COLORS } from '../core/store.js';
import { h, icon, iconButton, reactive } from './dom.js';
import { taskList, taskComposer } from './tasks.js';
import { noteList, noteButton } from './notes.js';
import { openPopover, closeOverlay, toast } from './overlay.js';

export function projectsView() {
  const list = reactive(h('div', { class: 'projects__list' }), () => {
    const projects = store.projectList();
    const active = store.ui.projectId;
    return [
      h('h2', { class: 'col__title' }, 'Projects'),
      h(
        'ul',
        { class: 'plist', role: 'list' },
        projects.map((p) => {
          const open = store.tasksForProject(p.id).filter((t) => !t.done).length;
          return h(
            'li',
            null,
            h(
              'button',
              { type: 'button', class: ['plist__item', p.id === active && 'is-active'], onClick: () => store.setUI({ projectId: p.id }) },
              h('i', { class: 'dot', style: { background: p.color } }),
              h('span', { class: 'plist__name' }, p.name),
              open ? h('span', { class: 'plist__count' }, open) : null,
            ),
          );
        }),
      ),
    ];
  });

  const newInput = h('input', { class: 'composer__input', placeholder: 'New project', 'aria-label': 'New project name', maxlength: '60' });
  const newForm = h('form', { class: 'composer' }, h('span', { class: 'composer__plus' }, icon('plus', 16)), newInput);
  newForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = newInput.value.trim();
    if (!name) return;
    const p = store.findOrCreateProject(name);
    newInput.value = '';
    store.setUI({ projectId: p.id });
  });

  let shownId;
  const detail = h('div', { class: 'projects__detail' });
  const renderDetail = () => {
    if (shownId !== undefined && !detail.isConnected) return unsub();
    const project = store.getProject(store.ui.projectId);
    const id = project?.id ?? null;
    if (id === shownId) return;
    shownId = id;
    detail.replaceChildren(project ? projectDetail(project) : emptyProjects());
  };
  const unsub = store.subscribe(renderDetail);
  renderDetail();

  return h('div', { class: 'projects' }, h('aside', { class: 'projects__side' }, list, newForm), detail);
}

function emptyProjects() {
  return h(
    'div',
    { class: 'projects__empty' },
    h('p', { class: 'empty' }, store.projectList().length ? 'Pick a project.' : 'Projects gather related tasks and notes — Portfolio, Work, Travel.'),
    h('p', { class: 'fineprint' }, 'Tip: type “#portfolio” while adding a task to file it instantly.'),
  );
}

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
      h('i', { class: 'dot dot--lg', style: { background: p.color } }),
      name,
      iconButton('more', 'Project options', (e) => projectMenu(e.currentTarget, p)),
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
    { class: 'project' },
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
            store.setUI({ projectId: store.projectList()[0]?.id ?? null });
            toast(`“${project.name}” deleted. Its tasks and notes were kept.`);
          },
        },
        'Delete project',
      ),
    ),
    { align: 'end' },
  );
}
