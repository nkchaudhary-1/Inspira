// Date helpers. A "day key" is a local-time 'YYYY-MM-DD' string — the backbone
// of the daily workspace. Everything (tasks, notes, events) hangs off a key.

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key, n) {
  const d = fromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

export function isValidKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && toKey(fromKey(key)) === key;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const weekdayName = (key) => WEEKDAYS[fromKey(key).getDay()];
export const monthName = (m) => MONTHS[m];

/** "Saturday, 02 September 2026" */
export function formatFull(key) {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sep 26" */
export function formatShort(key) {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** Relative label for a key vs today: Today / Tomorrow / Yesterday / null. */
export function relativeLabel(key, today = todayKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return null;
}

/** Split a clock time into display parts. */
export function clockParts(date, h24, withSeconds) {
  const h = date.getHours();
  const hh = h24 ? pad(h) : pad(h % 12 || 12);
  const time = `${hh}:${pad(date.getMinutes())}${withSeconds ? `:${pad(date.getSeconds())}` : ''}`;
  return { time, meridiem: h24 ? '' : h < 12 ? 'AM' : 'PM' };
}

/** Format an 'HH:MM' string (or Date) for display. */
export function formatTime(value, h24) {
  let h, m;
  if (value instanceof Date) {
    h = value.getHours();
    m = value.getMinutes();
  } else {
    [h, m] = value.split(':').map(Number);
  }
  if (h24) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Part of day, used for greeting and background atmosphere. */
export function daypart(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Month grid as weeks of day keys (6 rows × 7), including leading/trailing days.
 * weekStart: 0 = Sunday, 1 = Monday.
 */
export function monthMatrix(year, month, weekStart = 1) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(toKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)));
    }
    weeks.push(week);
  }
  return weeks;
}

export function weekdayInitials(weekStart = 1) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...names.slice(weekStart), ...names.slice(0, weekStart)];
}

/** Minutes as mm:ss (or h:mm:ss). */
export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Monday (or Sunday) that starts the week containing `key`. */
export function weekStartKey(key, weekStart = 1) {
  const d = fromKey(key);
  const offset = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - offset);
  return toKey(d);
}

/** The seven day keys of the week containing `key`. */
export function weekKeys(key, weekStart = 1) {
  const start = weekStartKey(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "21 – 27 September 2026", "28 September – 04 October 2026", "29 Dec 2025 – 04 Jan 2026" */
export function formatWeekRange(key, weekStart = 1) {
  const days = weekKeys(key, weekStart);
  const a = fromKey(days[0]);
  const b = fromKey(days[6]);
  if (a.getFullYear() !== b.getFullYear()) {
    return `${pad(a.getDate())} ${MONTHS[a.getMonth()].slice(0, 3)} ${a.getFullYear()} – ${pad(b.getDate())} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${pad(a.getDate())} ${MONTHS[a.getMonth()]} – ${pad(b.getDate())} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${pad(a.getDate())} – ${pad(b.getDate())} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** "September 2026" */
export function formatMonthYear(key) {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "26 September 2026" */
export function formatDayMonthYear(key) {
  const d = fromKey(key);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function addYears(key, n) {
  return addMonths(key, n * 12);
}
