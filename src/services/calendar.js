// Google Calendar (read-only). Fetches a month at a time across the user's
// selected calendars and caches it, so date navigation feels instant.

import { getDevice, setUI, ui } from '../core/store.js';
import { toKey, fromKey } from '../core/dates.js';
import { googleFetch } from './auth.js';

const API = 'https://www.googleapis.com/calendar/v3';
const TTL = 5 * 60 * 1000;
const fetched = new Map(); // 'YYYY-MM' -> timestamp

const monthOf = (key) => key.slice(0, 7);

function normalize(ev, calendar) {
  const allDay = Boolean(ev.start?.date);
  const start = allDay ? fromKey(ev.start.date) : new Date(ev.start.dateTime);
  const end = allDay ? fromKey(ev.end.date) : new Date(ev.end.dateTime);
  return {
    id: `${calendar.id}:${ev.id}`,
    title: ev.summary || '(No title)',
    allDay,
    start: start.getTime(),
    end: end.getTime(),
    location: ev.location || '',
    link: ev.htmlLink,
    meet: ev.hangoutLink || '',
    color: calendar.backgroundColor || null,
  };
}

/** Expand an event onto every day it touches (multi-day events). */
function daysFor(ev) {
  const keys = [];
  const d = new Date(ev.start);
  d.setHours(0, 0, 0, 0);
  const last = ev.end - 1;
  while (d.getTime() <= last || keys.length === 0) {
    keys.push(toKey(d));
    d.setDate(d.getDate() + 1);
    if (keys.length > 62) break;
  }
  return keys;
}

async function listCalendars() {
  const res = await googleFetch(`${API}/users/me/calendarList?minAccessRole=reader&fields=items(id,backgroundColor,selected,primary)`, {}, { calendar: true });
  const { items = [] } = await res.json();
  return items.filter((c) => c.selected || c.primary);
}

export async function loadMonth(dayKey, { force = false } = {}) {
  if (!getDevice().calendarConnected) return;
  const month = monthOf(dayKey);
  if (!force && Date.now() - (fetched.get(month) || 0) < TTL) return;
  fetched.set(month, Date.now());

  const first = fromKey(`${month}-01`);
  // Pad a week either side so the calendar grid's leading/trailing days get dots.
  const timeMin = new Date(first.getFullYear(), first.getMonth(), -6).toISOString();
  const timeMax = new Date(first.getFullYear(), first.getMonth() + 1, 7).toISOString();

  if (!Object.keys(ui.events).length) setUI({ calendarStatus: 'loading' });
  try {
    const calendars = await listCalendars();
    const lists = await Promise.all(
      calendars.map(async (cal) => {
        const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
        const res = await googleFetch(`${API}/calendars/${encodeURIComponent(cal.id)}/events?${params}`, {}, { calendar: true });
        const { items = [] } = await res.json();
        return items.filter((e) => e.status !== 'cancelled').map((e) => normalize(e, cal));
      }),
    );
    const events = { ...ui.events };
    // Clear the days we just refreshed, then refill.
    for (let d = new Date(timeMin); d < new Date(timeMax); d.setDate(d.getDate() + 1)) delete events[toKey(d)];
    for (const ev of lists.flat()) {
      for (const key of daysFor(ev)) (events[key] ||= []).push(ev);
    }
    for (const key of Object.keys(events)) {
      events[key].sort((a, b) => b.allDay - a.allDay || a.start - b.start);
    }
    setUI({ events, calendarStatus: 'ready' });
  } catch (err) {
    console.warn('[inspira] calendar failed', err);
    fetched.delete(month);
    setUI({ calendarStatus: 'error' });
  }
}

export function refreshCalendar() {
  fetched.clear();
  return loadMonth(ui.date, { force: true });
}

export function clearCalendar() {
  fetched.clear();
  setUI({ events: {}, calendarStatus: 'idle' });
}
