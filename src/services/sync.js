// Sync engine. Data lives in chrome.storage.local (works offline, no account
// needed). When signed in, a single JSON file in Google Drive's hidden
// appDataFolder is the shared copy: pull → merge (record-level LWW) → push.

import { getDevice, setDevice, setUI, snapshot, applyRemote, onLocalChange, ui } from '../core/store.js';
import { googleFetch } from './auth.js';

const FILE_NAME = 'inspira-sync.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const PUSH_DELAY = 2500;
const PERIOD = 5 * 60 * 1000;

let pushTimer = null;
let running = null;
let pendingAfterRun = false;

async function findFileId() {
  const cached = getDevice().sync?.fileId;
  if (cached) return cached;
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await googleFetch(`${DRIVE}/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
  const { files } = await res.json();
  return files?.[0]?.id || null;
}

async function download(fileId) {
  const res = await googleFetch(`${DRIVE}/files/${fileId}?alt=media`);
  return res.json();
}

async function upload(fileId, body) {
  const json = JSON.stringify({ ...body, schema: 2, savedAt: Date.now() });
  if (fileId) {
    await googleFetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    return fileId;
  }
  const boundary = `inspira${Date.now()}`;
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const res = await googleFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return (await res.json()).id;
}

async function runSync() {
  setUI({ syncStatus: 'syncing' });
  try {
    let fileId = await findFileId();
    if (fileId) {
      try {
        applyRemote(await download(fileId));
      } catch (err) {
        if (err.status !== 404) throw err;
        fileId = null; // file was removed (e.g. app data reset) — recreate it
      }
    }
    fileId = await upload(fileId, snapshot());
    setDevice({ sync: { fileId, lastSyncedAt: Date.now() } });
    setUI({ syncStatus: 'idle' });
  } catch (err) {
    console.warn('[inspira] sync failed', err);
    setUI({ syncStatus: 'error' });
  }
}

export function syncNow() {
  if (!getDevice().account) return Promise.resolve();
  if (running) {
    pendingAfterRun = true;
    return running;
  }
  running = runSync().finally(() => {
    running = null;
    if (pendingAfterRun) {
      pendingAfterRun = false;
      schedulePush();
    }
  });
  return running;
}

function schedulePush() {
  if (!getDevice().account) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, PUSH_DELAY);
}

export function startSync() {
  onLocalChange(schedulePush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - (getDevice().sync?.lastSyncedAt || 0) > 60_000) syncNow();
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), PERIOD);
  // Flush a pending push if the tab closes mid-debounce.
  window.addEventListener('pagehide', () => {
    if (pushTimer) syncNow();
  });
  if (getDevice().account) syncNow();
  else setUI({ syncStatus: 'off' });
}

export function syncLabel() {
  if (!getDevice().account) return 'Not signed in';
  if (ui.syncStatus === 'syncing') return 'Syncing…';
  if (ui.syncStatus === 'error') return 'Sync paused — will retry';
  const at = getDevice().sync?.lastSyncedAt;
  if (!at) return 'Waiting to sync';
  const mins = Math.round((Date.now() - at) / 60000);
  return mins < 1 ? 'Synced just now' : `Synced ${mins} min ago`;
}
