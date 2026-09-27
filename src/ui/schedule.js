// Calendar events: things that are scheduled. Visually distinct from tasks —
// a time column + colour bar, no checkbox.

import * as store from '../core/store.js';
import { formatTime } from '../core/dates.js';
import { refreshCalendar, calendarSource } from '../services/calendar.js';
import { h, icon } from './dom.js';
import { safeUrl } from '../core/sanitize.js';

export function eventList(dayKey, { limit, upcomingOnly = false, compact = false } = {}) {
  if (!calendarSource()) return compact ? null : connectPrompt();

  const status = store.ui.calendarStatus;
  const retry = () =>
    h('p', { class: 'empty' }, 'Couldn’t reach your calendar. ', h('button', { type: 'button', class: 'text-btn', onClick: () => refreshCalendar() }, 'Retry'));

  let events = store.ui.events[dayKey] || [];
  // Offline or token hiccup: keep showing what we already have.
  if (status === 'error' && !events.length) return compact ? null : retry();
  if (upcomingOnly) {
    const now = Date.now();
    events = events.filter((e) => e.allDay || e.end > now);
  }
  if (limit) events = events.slice(0, limit);

  if (!events.length) {
    if (status === 'loading' || status === 'idle') return h('p', { class: 'empty' }, 'Loading calendar…');
    return compact ? null : h('p', { class: 'empty' }, 'Nothing scheduled.');
  }

  const h24 = store.prefs().clock24;
  const now = Date.now();
  const list = h(
    'ul',
    { class: ['event-list', compact && 'event-list--compact'], role: 'list' },
    events.map((ev) =>
      h(
        'li',
        { class: ['event', !ev.allDay && ev.end < now && 'is-past', ev.start <= now && ev.end > now && !ev.allDay && 'is-now'] },
        h('span', { class: 'event__time' }, ev.allDay ? 'All day' : formatTime(new Date(ev.start), h24)),
        h('span', { class: 'event__bar', style: ev.color ? { background: ev.color } : null }),
        h(
          safeUrl(ev.link) ? 'a' : 'span',
          safeUrl(ev.link) ? { class: 'event__title', href: safeUrl(ev.link), target: '_blank', rel: 'noopener noreferrer' } : { class: 'event__title' },
          ev.title,
          ev.meet && !compact ? h('span', { class: 'event__meta' }, 'Meet') : null,
        ),
      ),
    ),
  );
  return status === 'error' && !compact ? [list, retry()] : list;
}

function connectPrompt() {
  return h(
    'div',
    { class: 'connect' },
    h('p', { class: 'empty' }, 'See your calendar alongside your day — Google, Outlook or iCloud.'),
    h(
      'button',
      { type: 'button', class: 'add-btn', onClick: () => import('./settings.js').then((m) => m.openSettings('account')) },
      icon('calendar', 16),
      h('span', null, 'Add your calendar'),
    ),
  );
}
