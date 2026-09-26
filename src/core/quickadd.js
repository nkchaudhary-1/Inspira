// Quick-add parsing for tasks. Plain text always works; tokens are optional:
//   #portfolio   → project
//   !  !!  !!!   → priority low / medium / high  (also !1 !2 !3)
//   @6pm @18:30  → time
// Example: "Review designs #work !! @4pm"

const TIME_RE = /^@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

export function parseTime(token) {
  const m = TIME_RE.exec(token);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseQuickAdd(input) {
  const out = { title: '', priority: 0, time: null, project: null };
  const keep = [];
  for (const token of input.trim().split(/\s+/)) {
    if (!token) continue;
    if (/^#[\p{L}\p{N}_-]+$/u.test(token) && !out.project) {
      out.project = token.slice(1);
    } else if (/^!{1,3}$/.test(token)) {
      out.priority = token.length;
    } else if (/^![1-3]$/.test(token)) {
      out.priority = Number(token[1]);
    } else if (token.startsWith('@') && !out.time && parseTime(token)) {
      out.time = parseTime(token);
    } else {
      keep.push(token);
    }
  }
  out.title = keep.join(' ');
  return out;
}
