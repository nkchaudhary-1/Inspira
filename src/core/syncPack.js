// Packs data for chrome.storage.sync, which is small: 100 KB in total and
// 8 KB per item. Only whole records are ever synced (never a truncated one,
// which would overwrite the full copy elsewhere). What doesn't fit simply
// stays on this device; the record-level merge never treats "missing" as
// "deleted".

export const SYNC_BUDGET = 90_000; // bytes of JSON, leaving headroom under 102,400
export const CHUNK_LIMIT = 8_000; // per item, under QUOTA_BYTES_PER_ITEM (8,192) incl. key
export const RECENT_DAYS = 60;

const DAY = 24 * 60 * 60 * 1000;
const size = (v) => JSON.stringify(v).length;

/**
 * Choose what to sync. Prefs and projects always go; then open tasks, then
 * everything else touched in the last RECENT_DAYS, newest first, while it fits.
 * Deletions (tombstones) ride along so they reach other computers.
 */
export function pickForSync(data, { now = Date.now(), budget = SYNC_BUDGET } = {}) {
  const out = { tasks: {}, notes: {}, projects: {}, prefs: data.prefs || {} };
  let used = size(out.prefs) + 64;
  for (const [id, rec] of Object.entries(data.projects || {})) {
    out.projects[id] = rec;
    used += size(rec) + id.length + 4;
  }

  const recent = (rec) => now - (rec.updatedAt || 0) < RECENT_DAYS * DAY;
  const candidates = [];
  for (const [id, rec] of Object.entries(data.tasks || {})) {
    const open = !rec.deleted && !rec.done;
    if (open || recent(rec)) candidates.push({ coll: 'tasks', id, rec, rank: open ? 0 : 1 });
  }
  for (const [id, rec] of Object.entries(data.notes || {})) {
    if (recent(rec)) candidates.push({ coll: 'notes', id, rec, rank: 1 });
  }
  candidates.sort((a, b) => a.rank - b.rank || (b.rec.updatedAt || 0) - (a.rec.updatedAt || 0));

  let skipped = 0;
  for (const { coll, id, rec } of candidates) {
    const cost = size(rec) + id.length + 4;
    if (used + cost > budget) {
      skipped++;
      continue;
    }
    out[coll][id] = rec;
    used += cost;
  }
  const total = Object.keys(data.tasks || {}).length + Object.keys(data.notes || {}).length;
  return { data: out, bytes: used, synced: candidates.length - skipped, skipped, total };
}

/** Split a JSON string into items that each stay under the per-item quota once stored. */
export function toChunks(json, limit = CHUNK_LIMIT) {
  const chunks = [];
  let i = 0;
  while (i < json.length) {
    let n = Math.min(limit, json.length - i);
    // Stored values are JSON-encoded again, so quotes and backslashes cost double.
    while (n > 1 && size(json.slice(i, i + n)) > limit) n = Math.floor(n * 0.9);
    chunks.push(json.slice(i, i + n));
    i += n;
  }
  return chunks;
}

/** Storage items for one packed snapshot: a manifest plus numbered chunks, all tagged with `rev`. */
export function toItems(payload, rev) {
  const chunks = toChunks(JSON.stringify(payload));
  const items = { 'inspira.meta': { rev, n: chunks.length, savedAt: payload.savedAt || 0 } };
  chunks.forEach((d, i) => (items[`inspira.c${i}`] = { rev, d }));
  return items;
}

/**
 * Rebuild the snapshot from storage items. Returns null while chunks from
 * different writes are mixed (sync can deliver them one at a time).
 */
export function fromItems(items) {
  const meta = items?.['inspira.meta'];
  if (!meta?.n) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) {
    const c = items[`inspira.c${i}`];
    if (!c || c.rev !== meta.rev) return null;
    json += c.d;
  }
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Chunk keys left over from a larger earlier write. */
export function staleKeys(items, n) {
  return Object.keys(items || {}).filter((k) => /^inspira\.c\d+$/.test(k) && Number(k.slice(9)) >= n);
}
