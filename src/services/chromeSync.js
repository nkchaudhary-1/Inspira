// Sync through the user's Chrome profile (chrome.storage.sync): no account,
// no server. Chrome carries the data to every computer where the same profile
// is signed in with sync on. Space is small, so syncPack chooses what fits;
// the rest stays on this device and the record-level merge keeps both.

import { getDevice, setDevice, snapshot, applyRemote, onLocalChange } from '../core/store.js';
import { uid } from '../core/ids.js';
import { pickForSync, toItems, fromItems, staleKeys } from '../core/syncPack.js';

const area = typeof chrome !== 'undefined' ? chrome.storage?.sync : null;
const PUSH_DELAY = 3000; // stays well under Chrome's 120 writes/minute
const PULL_DELAY = 400;

let pushTimer = null;
let pullTimer = null;
let status = 'idle'; // idle | error | full
let lastRev = null;

export const chromeSyncAvailable = () => Boolean(area);
export const chromeSyncOn = () => chromeSyncAvailable() && getDevice().chromeSync !== false;

async function pull() {
  if (!chromeSyncOn()) return;
  try {
    const remote = fromItems(await area.get(null));
    if (remote && remote.rev !== lastRev) applyRemote(remote);
  } catch (err) {
    console.warn('[inspira] chrome sync read failed', err);
  }
}

async function push() {
  pushTimer = null;
  if (!chromeSyncOn()) return;
  const packed = pickForSync(snapshot());
  const rev = uid();
  lastRev = rev;
  const items = toItems({ ...packed.data, rev, savedAt: Date.now() }, rev);
  try {
    const before = await area.get(null);
    await area.set(items);
    const stale = staleKeys(before, items['inspira.meta'].n);
    if (stale.length) await area.remove(stale);
    status = packed.skipped ? 'full' : 'idle';
    setDevice({ chromeSyncInfo: { at: Date.now(), synced: packed.synced, skipped: packed.skipped, bytes: packed.bytes } });
  } catch (err) {
    console.warn('[inspira] chrome sync write failed', err);
    status = 'error';
    setDevice({ chromeSyncInfo: { ...getDevice().chromeSyncInfo, error: String(err?.message || err) } });
  }
}

function schedulePush() {
  if (!chromeSyncOn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DELAY);
}

export function startChromeSync() {
  if (!area) return;
  onLocalChange(schedulePush);
  chrome.storage.onChanged.addListener((changes, name) => {
    if (name !== 'sync' || !Object.keys(changes).some((k) => k.startsWith('inspira.'))) return;
    clearTimeout(pullTimer);
    pullTimer = setTimeout(pull, PULL_DELAY);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (pushTimer) (clearTimeout(pushTimer), push());
    } else pull();
  });
  window.addEventListener('pagehide', () => pushTimer && (clearTimeout(pushTimer), push()));
  // First run on this computer: take what the profile already has, then share ours.
  pull().then(() => chromeSyncOn() && !getDevice().chromeSyncInfo?.at && schedulePush());
}

/** Turn Chrome sync on or off for this computer. */
export function setChromeSync(on) {
  setDevice({ chromeSync: on });
  if (on) pull().then(push);
}

export function chromeSyncLabel() {
  if (!chromeSyncAvailable()) return 'Available when Inspira runs as a Chrome extension';
  if (!chromeSyncOn()) return 'Off — everything stays on this computer';
  const info = getDevice().chromeSyncInfo;
  if (status === 'error' || info?.error) return 'Couldn’t sync just now — will retry';
  if (!info?.at) return 'Waiting for the first sync';
  const mins = Math.round((Date.now() - info.at) / 60000);
  const when = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : 'over an hour ago';
  const extra = info.skipped ? ` · ${info.skipped} older item${info.skipped === 1 ? '' : 's'} stay on this computer` : '';
  return `Synced ${when}${extra}`;
}
