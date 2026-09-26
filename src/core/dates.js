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

/** "Saturday, September 26" */
export function formatLong(key) {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Saturday, 02 September 2026" */
export function formatFull(key) {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "September 26" */
export function formatMonthDay(key) {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
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
