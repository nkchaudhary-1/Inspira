// Record-level last-write-wins merge used by sync. Every record carries
// `updatedAt`; deletions are tombstones (`deleted: true`) so they propagate.

export const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000;
const COLLECTIONS = ['tasks', 'notes', 'projects'];

export function mergeCollection(local = {}, remote = {}) {
  const out = { ...local };
  for (const [id, rec] of Object.entries(remote)) {
    const mine = out[id];
    if (!mine || (rec.updatedAt || 0) > (mine.updatedAt || 0)) out[id] = rec;
  }
  return out;
}

export function purgeTombstones(collection, now = Date.now(), ttl = TOMBSTONE_TTL) {
  const out = {};
  for (const [id, rec] of Object.entries(collection)) {
    if (rec.deleted && now - (rec.updatedAt || 0) > ttl) continue;
    out[id] = rec;
  }
  return out;
}

export function mergeData(local, remote, now = Date.now()) {
  const out = {};
  for (const key of COLLECTIONS) {
    out[key] = purgeTombstones(mergeCollection(local[key], remote?.[key]), now);
  }
  const lp = local.prefs || {};
  const rp = remote?.prefs || {};
  out.prefs = (rp.updatedAt || 0) > (lp.updatedAt || 0) ? { ...lp, ...rp } : lp;
  return out;
}

/** Stable fingerprint to tell whether a merge changed anything. */
export function fingerprint(data) {
  const parts = [];
  for (const key of COLLECTIONS) {
    const coll = data[key] || {};
    for (const id of Object.keys(coll).sort()) parts.push(`${key}:${id}:${coll[id].updatedAt || 0}`);
  }
  parts.push(`prefs:${data.prefs?.updatedAt || 0}`);
  return parts.join('|');
}
