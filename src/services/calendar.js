// Calendar events, read-only, from one of two sources:
//   ics    — a private iCal link (Google Calendar, Outlook, iCloud); no sign-in
//   google — the Google Calendar API, when signed in with Google
// Fetched a month at a time and cached, so date navigation feels instant.

import { getDevice, setDevice, setUI, ui } from '../core/store.js';
import { toKey, fromKey } from '../core/dates.js';
import { parseICS, expandEvents } from '../core/ics.js';
import { safeUrl, safeColor } from '../core/sanitize.js';
import { googleFetch } from './auth.js';

export const calendarSource = () => (getDevice().icsUrl ? 'ics' : getDevice().calendarConnected ? 'google' : null);

// ---------- iCal link ----------

/** Hosts whose secret iCal links we can read (declared as optional host permissions). */
export const ICS_HOSTS = ['calendar.google.com', 'outlook.office365.com', 'outlook.live.com', '*.icloud.com'];
const ICS_TTL = 15 * 60 * 1000;
const ICS_MAX = 5 * 1024 * 1024; // a personal calendar is far smaller; refuse anything huge
let feed = null; // { url, at, parsed }

/** webcal:// → https://, and only hosts we support. Returns a URL or null. */
export function normalizeIcsUrl(input) {
  try {
    const url = new URL(input.trim().replace(/^webcals?:\/\//i, 'https://'));
    if (url.protocol !== 'https:') return null;
    const ok = ICS_HOSTS.some((h) => (h.startsWith('*.') ? url.hostname.endsWith(h.slice(1)) : url.hostname === h));
    return ok ? url.href : null;
  } catch {
    return null;
  }
}

export const icsOrigin = (url) => `${new URL(url).origin}/*`;

async function fetchFeed(url, { force = false } = {}) {
  if (!force && feed?.url === url && Date.now() - feed.at < ICS_TTL) return feed.parsed;
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`calendar feed ${res.status}`);
  if (Number(res.headers.get('content-length')) > ICS_MAX) throw new Error('calendar feed too large');
  const text = await res.text();
  if (text.length > ICS_MAX) throw new Error('calendar feed too large');
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not a calendar feed');
  const parsed = parseICS(text);
  feed = { url, at: Date.now(), parsed };
  return parsed;
}

/** Check a link works before saving it; resolves to the calendar's name. */
export async function testIcsUrl(url) {
  const parsed = await fetchFeed(url, { force: true });
  return parsed.name || 'Calendar';
}

export function setIcsUrl(url, name) {
  setDevice({ icsUrl: url, icsName: name || 'Calendar' });
  refreshCalendar();
}

export function removeIcsUrl() {
  const url = getDevice().icsUrl;
  setDevice({ icsUrl: null, icsName: '' });
  feed = null;
  clearCalendar();
  if (url && typeof chrome !== 'undefined') chrome.permissions?.remove({ origins: [icsOrigin(url)] }).catch(() => {});
}

async function icsEvents(timeMin, timeMax, force) {
  const parsed = await fetchFeed(getDevice().icsUrl, { force });
  return expandEvents(parsed, new Date(timeMin).getTime(), new Date(timeMax).getTime()).map((e) => ({
    ...e,
    title: e.title.slice(0, 300),
    link: safeUrl(e.link),
  }));
}

// ---------- Google Calendar API ----------

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
    link: safeUrl(ev.htmlLink),
    meet: safeUrl(ev.hangoutLink),
    color: safeColor(calendar.backgroundColor),
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
  const source = calendarSource();
  if (!source) return;
  const month = monthOf(dayKey);
  if (!force && Date.now() - (fetched.get(month) || 0) < TTL) return;
  fetched.set(month, Date.now());

  const first = fromKey(`${month}-01`);
  // Pad a week either side so the calendar grid's leading/trailing days get dots.
  const timeMin = new Date(first.getFullYear(), first.getMonth(), -6).toISOString();
  const timeMax = new Date(first.getFullYear(), first.getMonth() + 1, 7).toISOString();

  if (!Object.keys(ui.events).length) setUI({ calendarStatus: 'loading' });
  try {
    const lists =
      source === 'ics'
        ? [await icsEvents(timeMin, timeMax, force)]
        : await Promise.all(
            (await listCalendars()).map(async (cal) => {
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
