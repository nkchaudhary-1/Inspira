// Validation for data that arrives from outside this tab: an imported file,
// Chrome sync, Drive sync or a calendar feed. Records are rebuilt field by
// field with the expected types and sizes, so nothing unexpected (odd keys,
// huge strings, script URLs, CSS in colour fields) ever reaches the page.

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : 0);
const bool = (v) => v === true;
const opt = (v, re) => (typeof v === 'string' && re.test(v) ? v : null);

export const isSafeId = (id) => typeof id === 'string' && ID.test(id);

/** A colour usable in a style: #rgb / #rrggbb, or null. */
export const safeColor = (v) => opt(v, HEX);

/** Only http(s) links are ever rendered as hrefs. */
export function safeUrl(v) {
  if (typeof v !== 'string' || v.length > 2048) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

const common = (r) => ({
  id: r.id,
  createdAt: num(r.createdAt),
  updatedAt: num(r.updatedAt),
  deleted: bool(r.deleted),
  projectId: isSafeId(r.projectId) ? r.projectId : null,
});

const CLEAN = {
  tasks: (r) => ({
    ...common(r),
    title: str(r.title, 500),
    date: opt(r.date, DATE),
    time: opt(r.time, TIME),
    priority: [0, 1, 2, 3].includes(r.priority) ? r.priority : 0,
    reminder: Number.isFinite(r.reminder) ? r.reminder : null,
    done: bool(r.done),
    doneAt: Number.isFinite(r.doneAt) ? r.doneAt : null,
  }),
  notes: (r) => ({ ...common(r), title: str(r.title, 500), body: str(r.body, 50_000), date: opt(r.date, DATE) }),
  projects: (r) => {
    const { projectId, ...rest } = common(r);
    return { ...rest, name: str(r.name, 60) || 'Untitled', color: safeColor(r.color) || '#8a8fc2', order: num(r.order) };
  },
};

/** A clean copy of one collection: valid ids, plain objects, known fields. */
export function cleanCollection(kind, coll) {
  const out = {};
  if (!coll || typeof coll !== 'object' || Array.isArray(coll)) return out;
  for (const [id, rec] of Object.entries(coll)) {
    if (!isSafeId(id) || !rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
    out[id] = CLEAN[kind]({ ...rec, id });
  }
  return out;
}

const THEMES = ['system', 'light', 'dark'];

/** Prefs from outside: known keys only, each with its expected type. */
export function cleanPrefs(p) {
  if (!p || typeof p !== 'object') return {};
  const out = {};
  if (THEMES.includes(p.theme)) out.theme = p.theme;
  for (const k of ['clock24', 'showSeconds', 'showQuoteOnClock']) if (typeof p[k] === 'boolean') out[k] = p[k];
  for (const k of ['quoteCategory', 'units']) if (typeof p[k] === 'string' && p[k].length <= 32) out[k] = p[k];
  if (typeof p.name === 'string') out.name = p.name.slice(0, 40);
  for (const k of ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes']) if (Number.isFinite(p[k]) && p[k] > 0 && p[k] <= 180) out[k] = p[k];
  if (p.weekStart === 0 || p.weekStart === 1) out.weekStart = p.weekStart;
  if (Number.isFinite(p.updatedAt)) out.updatedAt = p.updatedAt;
  if (p.backdrop && typeof p.backdrop === 'object' && !Array.isArray(p.backdrop)) {
    const b = {};
    for (const [k, v] of Object.entries(p.backdrop)) {
      if (!/^[a-zA-Z]{1,24}$/.test(k)) continue;
      if ((typeof v === 'string' && v.length <= 24) || Number.isFinite(v)) b[k] = v;
    }
    out.backdrop = b;
  }
  return out;
}

/** Everything that can arrive from outside, cleaned in one go. */
export function cleanData(remote) {
  if (!remote || typeof remote !== 'object') return {};
  return {
    tasks: cleanCollection('tasks', remote.tasks),
    notes: cleanCollection('notes', remote.notes),
    projects: cleanCollection('projects', remote.projects),
    prefs: cleanPrefs(remote.prefs),
  };
}
