// A small iCalendar (.ics) reader for "secret calendar link" feeds from Google
// Calendar, Outlook and iCloud. Handles all-day, UTC, floating and TZID times,
// multi-day events, and the recurrence rules those apps emit (DAILY / WEEKLY /
// MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY), plus
// EXDATE exclusions and RECURRENCE-ID overrides.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_STEPS = 5000;

// ---------- lines & properties ----------

function unfold(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
}

function parseLine(line) {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// ---------- time ----------

const formatters = new Map();
function tzOffset(ms, tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

function validZone(tz) {
  if (!tz) return false;
  try {
    tzOffset(0, tz);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts → epoch ms. zone: 'UTC' | 'local' | IANA name. */
export function wallToMs({ y, mo, d, h = 0, mi = 0, s = 0 }, zone) {
  if (zone === 'UTC') return Date.UTC(y, mo, d, h, mi, s);
  if (zone === 'local') return new Date(y, mo, d, h, mi, s).getTime();
  const guess = Date.UTC(y, mo, d, h, mi, s);
  let ms = guess - tzOffset(guess, zone);
  ms = guess - tzOffset(ms, zone); // second pass settles DST edges
  return ms;
}

/** Parse a DATE or DATE-TIME property into wall parts + zone. */
function parseTime(prop) {
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const parts = { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  const allDay = prop.params.VALUE === 'DATE' || !m[4];
  if (allDay) return { parts, zone: 'local', allDay: true };
  if (m[7]) return { parts, zone: 'UTC', allDay: false };
  const tz = prop.params.TZID;
  return { parts, zone: validZone(tz) ? tz : 'local', allDay: false };
}

function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (((+m[2] || 0) * 7 + (+m[3] || 0)) * DAY_MS + ((+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000);
}

function parseRule(v) {
  const rule = {};
  for (const part of v.split(';')) {
    const [k, val] = part.split('=');
    if (k && val) rule[k.toUpperCase()] = val;
  }
  return {
    freq: rule.FREQ,
    interval: Math.max(1, Number(rule.INTERVAL) || 1),
    count: rule.COUNT ? Number(rule.COUNT) : null,
    until: rule.UNTIL ? parseTime({ value: rule.UNTIL, params: {} }) : null,
    byday: rule.BYDAY ? rule.BYDAY.split(',').map((x) => ({ n: parseInt(x, 10) || 0, wd: WEEKDAYS.indexOf(x.slice(-2)) })) : null,
    bymonthday: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : null,
  };
}

// ---------- parse ----------

/** Parse an .ics feed into raw VEVENTs and the calendar's display name. */
export function parseICS(text) {
  const events = [];
  let name = '';
  let cur = null;
  for (const line of unfold(text).split('\n')) {
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.start) events.push(cur);
      cur = null;
      continue;
    }
    const prop = parseLine(line);
    if (!prop) continue;
    if (!cur) {
      if (prop.name === 'X-WR-CALNAME') name = unescapeText(prop.value);
      continue;
    }
    switch (prop.name) {
      case 'UID':
        cur.uid = prop.value;
        break;
      case 'SUMMARY':
        cur.title = unescapeText(prop.value);
        break;
      case 'LOCATION':
        cur.location = unescapeText(prop.value);
        break;
      case 'URL':
        cur.url = prop.value;
        break;
      case 'STATUS':
        cur.cancelled = prop.value.toUpperCase() === 'CANCELLED';
        break;
      case 'DTSTART':
        cur.start = parseTime(prop);
        break;
      case 'DTEND':
        cur.end = parseTime(prop);
        break;
      case 'DURATION':
        cur.duration = parseDuration(prop.value);
        break;
      case 'RRULE':
        cur.rule = parseRule(prop.value);
        break;
      case 'EXDATE':
        for (const v of prop.value.split(',')) {
          const t = parseTime({ value: v, params: prop.params });
          if (t) cur.exdates.push(t);
        }
        break;
      case 'RECURRENCE-ID':
        cur.recurrenceId = parseTime(prop);
        break;
    }
  }
  return { name, events };
}

// ---------- expand ----------

const toMs = (t) => wallToMs(t.parts, t.zone);
const addDays = (p, n) => {
  const d = new Date(Date.UTC(p.y, p.mo, p.d + n));
  return { ...p, y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() };
};
const weekday = (p) => new Date(Date.UTC(p.y, p.mo, p.d)).getUTCDay();
const daysInMonth = (y, mo) => new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();

/** The nth weekday of a month (n<0 counts from the end), or null. */
function nthWeekday(y, mo, wd, n) {
  const days = [];
  for (let d = 1; d <= daysInMonth(y, mo); d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === wd) days.push(d);
  const d = n > 0 ? days[n - 1] : days[days.length + n];
  return d ? { y, mo, d } : null;
}

/** Candidate start dates (wall parts) of a recurring event, in order. */
function* occurrences(start, rule) {
  const base = start.parts;
  const time = { h: base.h, mi: base.mi, s: base.s };
  let steps = 0;
  if (rule.freq === 'DAILY') {
    for (let p = base; steps++ < MAX_STEPS; p = addDays(p, rule.interval)) yield p;
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byday?.map((b) => b.wd).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) || [weekday(base)];
    let monday = addDays(base, -((weekday(base) + 6) % 7));
    for (; steps++ < MAX_STEPS; monday = addDays(monday, 7 * rule.interval)) {
      for (const wd of days) yield { ...addDays(monday, (wd + 6) % 7), ...time };
    }
  } else if (rule.freq === 'MONTHLY') {
    for (let k = 0; steps++ < MAX_STEPS; k += rule.interval) {
      const y = base.y + Math.floor((base.mo + k) / 12);
      const mo = (base.mo + k) % 12;
      const days = [];
      if (rule.byday) for (const b of rule.byday) if (b.n) days.push(nthWeekday(y, mo, b.wd, b.n));
      for (const md of rule.bymonthday || (rule.byday ? [] : [base.d])) {
        const d = md > 0 ? md : daysInMonth(y, mo) + md + 1;
        if (d >= 1 && d <= daysInMonth(y, mo)) days.push({ y, mo, d });
      }
      for (const p of days.filter(Boolean).sort((a, b) => a.d - b.d)) yield { ...p, ...time };
    }
  } else if (rule.freq === 'YEARLY') {
    for (let y = base.y; steps++ < MAX_STEPS; y += rule.interval) {
      if (base.d <= daysInMonth(y, base.mo)) yield { ...base, y };
    }
  } else {
    yield base;
  }
}

/**
 * Events overlapping [from, to), expanded and normalised to the app's shape:
 * { id, title, allDay, start, end, location, link, meet, color }.
 */
export function expandEvents({ events }, from, to) {
  const overrides = new Map(); // uid|startMs -> event
  for (const ev of events) if (ev.recurrenceId && ev.uid) overrides.set(`${ev.uid}|${toMs(ev.recurrenceId)}`, ev);

  const out = [];
  const emit = (ev, startMs) => {
    if (ev.cancelled) return;
    const first = toMs(ev.start);
    const length = ev.end ? toMs(ev.end) - first : ev.duration || (ev.start.allDay ? DAY_MS : 0);
    const endMs = startMs + Math.max(length, 0);
    if (endMs <= from && !(endMs === startMs && startMs >= from)) return;
    if (startMs >= to) return;
    out.push({
      id: `${ev.uid || ev.title}:${startMs}`,
      title: ev.title || '(No title)',
      allDay: ev.start.allDay,
      start: startMs,
      end: endMs,
      location: ev.location || '',
      link: ev.url || '',
      meet: '',
      color: null,
    });
  };

  for (const ev of events) {
    if (ev.recurrenceId) continue; // emitted in place of the occurrence it replaces
    if (!ev.rule) {
      emit(ev, toMs(ev.start));
      continue;
    }
    const excluded = new Set(ev.exdates.map(toMs));
    const until = ev.rule.until ? toMs(ev.rule.until) : Infinity;
    const first = toMs(ev.start);
    let n = 0;
    for (const parts of occurrences(ev.start, ev.rule)) {
      const ms = wallToMs(parts, ev.start.zone);
      if (ms < first) continue; // BYDAY weeks can start before DTSTART
      if (ms > until || ms >= to) break;
      n++;
      if (ev.rule.count && n > ev.rule.count) break;
      if (excluded.has(ms)) continue;
      const replaced = overrides.get(`${ev.uid}|${ms}`);
      if (replaced) emit(replaced, toMs(replaced.start));
      else emit(ev, ms);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
