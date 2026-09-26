// Lightweight month view for awareness + jumping to a day. Dots only:
// filled = your tasks/notes, ring = calendar events. No event grid.

import * as store from '../core/store.js';
import { monthMatrix, weekdayInitials, monthName, fromKey, todayKey, formatLong, addMonths, addDays, formatTime, relativeLabel } from '../core/dates.js';
import { loadMonth } from '../services/calendar.js';
import { h, iconButton } from './dom.js';
import { openPopover, closeOverlay } from './overlay.js';

export function openCalendar(anchor, onPick) {
  let cursor = store.ui.date; // selected day inside the popover
  let pop;

  const pick = (key) => {
    closeOverlay();
    onPick(key);
  };

  const render = () => {
    const d = fromKey(cursor);
    const year = d.getFullYear();
    const month = d.getMonth();
    const weekStart = store.prefs().weekStart;
    const today = todayKey();
    const withItems = store.daysWithItems();
    const events = store.ui.events;
    loadMonth(cursor);

    const grid = h(
      'div',
      { class: 'cal__grid', role: 'grid', 'aria-label': `${monthName(month)} ${year}` },
      weekdayInitials(weekStart).map((w) => h('span', { class: 'cal__dow', role: 'columnheader' }, w.slice(0, 2))),
      monthMatrix(year, month, weekStart)
        .flat()
        .map((key) => {
          const day = fromKey(key);
          return h(
            'button',
            {
              type: 'button',
              role: 'gridcell',
              class: [
                'cal__day',
                day.getMonth() !== month && 'is-outside',
                key === today && 'is-today',
                key === cursor && 'is-selected',
                key === store.ui.date && 'is-current',
              ],
              'aria-selected': String(key === cursor),
              'aria-label': formatLong(key),
              tabindex: key === cursor ? '0' : '-1',
              onClick: () => {
                cursor = key;
                refresh();
              },
              onDblclick: () => pick(key),
            },
            h('span', null, day.getDate()),
            h(
              'span',
              { class: 'cal__dots' },
              withItems.has(key) && h('i', { class: 'cal__dot' }),
              events[key]?.length && h('i', { class: 'cal__dot cal__dot--event' }),
            ),
          );
        }),
    );

    grid.addEventListener('keydown', (e) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (moves[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        cursor = addDays(cursor, moves[e.key]);
        refresh();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        pick(cursor);
      }
    });

    return h(
      'div',
      { class: 'cal' },
      h(
        'header',
        { class: 'cal__head' },
        h('span', { class: 'cal__month' }, `${monthName(month)} ${year}`),
        h(
          'div',
          { class: 'cal__nav' },
          iconButton('chevronLeft', 'Previous month', () => ((cursor = addMonths(cursor, -1)), refresh()), { size: 16 }),
          h('button', { type: 'button', class: 'text-btn', onClick: () => ((cursor = today), refresh()) }, 'Today'),
          iconButton('chevronRight', 'Next month', () => ((cursor = addMonths(cursor, 1)), refresh()), { size: 16 }),
        ),
      ),
      grid,
      agenda(cursor, pick),
    );
  };

  const refresh = () => {
    pop.replaceChildren(render());
    pop.querySelector('.cal__day.is-selected')?.focus({ preventScroll: true });
  };

  pop = openPopover(anchor, render(), { align: 'center', className: 'popover--cal' });
  pop.querySelector('.cal__day.is-selected')?.focus({ preventScroll: true });
  // Refresh dots when events arrive.
  const unsub = store.subscribe(() => (pop.isConnected ? pop.contains(document.activeElement) && refresh() : unsub()));
}

function agenda(key, pick) {
  const h24 = store.prefs().clock24;
  const events = store.ui.events[key] || [];
  const tasks = store.tasksForDate(key);
  const open = tasks.filter((t) => !t.done).length;
  const notes = store.notesForDate(key).length;
  const rel = relativeLabel(key);
  return h(
    'div',
    { class: 'cal__agenda' },
    h('div', { class: 'eyebrow' }, rel || fromKey(key).toLocaleDateString(undefined, { weekday: 'long' })),
    h('div', { class: 'cal__agenda-date' }, formatLong(key).split(', ')[1]),
    events.length
      ? h(
          'ul',
          { class: 'cal__events', role: 'list' },
          events
            .slice(0, 4)
            .map((ev) =>
              h('li', null, h('span', { class: 'event__time' }, ev.allDay ? 'All day' : formatTime(new Date(ev.start), h24)), h('span', null, ev.title)),
            ),
        )
      : null,
    h(
      'p',
      { class: 'cal__summary' },
      [open && `${open} open task${open > 1 ? 's' : ''}`, notes && `${notes} note${notes > 1 ? 's' : ''}`].filter(Boolean).join('  ·  ') ||
        (events.length ? '' : 'Nothing here yet.'),
    ),
    h('button', { type: 'button', class: 'add-btn cal__open', onClick: () => pick(key) }, 'Open day →'),
  );
}
