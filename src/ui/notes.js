// Notes: things I want to remember. A card list; clicking a card turns it into
// an inline editor (no document chrome). "- " at line start becomes a bullet.

import * as store from '../core/store.js';
import { formatShort } from '../core/dates.js';
import { h, icon, autosize } from './dom.js';
import { toast } from './overlay.js';

let focusTitleFor = null;

export function createNote(fields) {
  const note = store.addNote(fields);
  focusTitleFor = note.id;
  store.setUI({ openNoteId: note.id });
  return note;
}

export function closeNote() {
  const id = store.ui.openNoteId;
  if (!id) return;
  // Blur first: reactive regions don't re-render while an input inside has focus.
  if (document.activeElement?.closest?.('.note--editing')) document.activeElement.blur();
  const note = store.getData().notes[id];
  if (note && !note.title.trim() && !note.body.trim()) store.deleteNote(id);
  store.setUI({ openNoteId: null });
}

export function noteList(notes, { showDate = false, showProject = true, empty } = {}) {
  if (!notes.length) return empty ? h('p', { class: 'empty' }, empty) : null;
  return h(
    'div',
    { class: 'note-list' },
    notes.map((n) => (n.id === store.ui.openNoteId ? noteEditor(n) : noteCard(n, { showDate, showProject }))),
  );
}

function noteCard(note, { showDate, showProject }) {
  const project = showProject ? store.getProject(note.projectId) : null;
  const lines = note.body
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 5);
  const open = () => {
    closeNote();
    store.setUI({ openNoteId: note.id });
  };
  return h(
    'article',
    {
      class: ['note', Date.now() - note.createdAt < 600 && 'is-new'],
      tabindex: '0',
      role: 'button',
      'aria-label': `Open note ${note.title || 'Untitled'}`,
      onClick: open,
      onKeydown: (e) => e.key === 'Enter' && open(),
    },
    h('h3', { class: 'note__title' }, note.title || 'Untitled'),
    lines.length ? h('div', { class: 'note__preview' }, renderLines(lines)) : null,
    (project || showDate) &&
      h(
        'div',
        { class: 'note__meta' },
        showDate && note.date && h('span', { class: 'meta' }, formatShort(note.date)),
        project && h('span', { class: 'meta meta--project' }, h('i', { class: 'dot', style: { background: project.color } }), project.name),
      ),
  );
}

function renderLines(lines) {
  const out = [];
  let bullets = null;
  for (const line of lines) {
    const m = /^\s*[•\-*]\s+(.*)$/.exec(line);
    if (m) {
      if (!bullets) out.push((bullets = h('ul', null)));
      bullets.append(h('li', null, m[1]));
    } else {
      bullets = null;
      out.push(h('p', null, line));
    }
  }
  return out;
}

function noteEditor(note) {
  const title = h('input', {
    class: 'note-editor__title',
    value: note.title,
    placeholder: 'Title',
    'aria-label': 'Note title',
    maxlength: '200',
    onInput: (e) => store.updateNote(note.id, { title: e.target.value }),
  });
  const body = autosize(
    h('textarea', {
      class: 'note-editor__body',
      value: note.body,
      placeholder: 'Write freely.  "- " starts a bullet.',
      'aria-label': 'Note',
      rows: '3',
      onInput: (e) => {
        bulletize(e);
        store.updateNote(note.id, { body: e.target.value });
      },
      onKeydown: (e) => continueBullet(e, note.id),
    }),
  );
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeNote();
    }
  };
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      body.focus();
    }
    onKey(e);
  });
  body.addEventListener('keydown', onKey);

  const projects = store.projectList();
  const project = h(
    'select',
    { class: 'note-editor__select', 'aria-label': 'Project', onChange: (e) => store.updateNote(note.id, { projectId: e.target.value || null }) },
    h('option', { value: '' }, 'No project'),
    projects.map((p) => h('option', { value: p.id, selected: p.id === note.projectId }, p.name)),
  );

  if (focusTitleFor === note.id) {
    focusTitleFor = null;
    requestAnimationFrame(() => title.focus());
  }

  return h(
    'article',
    { class: 'note note--editing' },
    title,
    body,
    h(
      'footer',
      { class: 'note-editor__foot' },
      project,
      note.date
        ? h(
            'button',
            { type: 'button', class: 'text-btn', title: 'Keep this note without a date', onClick: () => store.updateNote(note.id, { date: null }) },
            `${formatShort(note.date)} ×`,
          )
        : h('button', { type: 'button', class: 'text-btn', onClick: () => store.updateNote(note.id, { date: store.ui.date }) }, 'Pin to day'),
      h('span', { class: 'spacer' }),
      h(
        'button',
        {
          type: 'button',
          class: 'text-btn text-btn--danger',
          onClick: () => {
            store.deleteNote(note.id);
            store.setUI({ openNoteId: null });
            toast('Note deleted', { label: 'Undo', run: () => store.updateNote(note.id, { deleted: false }) });
          },
        },
        'Delete',
      ),
      h('button', { type: 'button', class: 'text-btn text-btn--strong', onClick: closeNote }, 'Done'),
    ),
  );
}

/** "- " typed at the start of a line becomes "• ". */
function bulletize(e) {
  const ta = e.target;
  if (e.inputType !== 'insertText' || e.data !== ' ') return;
  const pos = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
  const typed = ta.value.slice(lineStart, pos);
  if (typed === '- ' || typed === '• - ') {
    ta.setRangeText('• ', lineStart, pos, 'end');
  }
}

/** Enter on a bullet line continues the list; Enter on an empty bullet ends it. */
function continueBullet(e, id) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const ta = e.target;
  const pos = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
  const line = ta.value.slice(lineStart, pos);
  if (!line.startsWith('• ')) return;
  e.preventDefault();
  if (line.trim() === '•') ta.setRangeText('', lineStart, pos, 'end');
  else ta.setRangeText('\n• ', pos, ta.selectionEnd, 'end');
  ta.dispatchEvent(new Event('input'));
  store.updateNote(id, { body: ta.value });
}

export function noteButton(label, fields) {
  return h('button', { type: 'button', class: 'add-btn add-btn--box', onClick: () => createNote(fields()) }, icon('plus', 16), h('span', null, label));
}
