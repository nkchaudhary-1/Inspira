// Google auth via chrome.identity. Scopes are requested incrementally:
//   sign-in  → profile + Drive appData (private sync file, invisible in Drive UI)
//   calendar → calendar.readonly, only when the user connects Calendar.

import { getDevice, setDevice, prefs, setPrefs } from '../core/store.js';

export const SCOPES = {
  base: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/drive.appdata'],
  calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
};

const identity = typeof chrome !== 'undefined' ? chrome.identity : null;

export function authAvailability() {
  if (!identity?.getAuthToken) return { ok: false, reason: 'Google sign-in works when Inspira runs as a Chrome extension.' };
  const clientId = chrome.runtime.getManifest().oauth2?.client_id || '';
  if (!clientId || clientId.startsWith('YOUR_')) {
    return { ok: false, reason: 'Google sign-in isn’t configured in this build (missing OAuth client ID).' };
  }
  return { ok: true };
}

function scopesFor(withCalendar) {
  return withCalendar ? [...SCOPES.base, ...SCOPES.calendar] : SCOPES.base;
}

export async function getToken({ interactive = false, calendar = getDevice().calendarConnected } = {}) {
  const res = await identity.getAuthToken({ interactive, scopes: scopesFor(calendar) });
  // Chrome ≥105 resolves an object; older builds resolved the string.
  return typeof res === 'string' ? res : res?.token;
}

/** fetch() against a Google API with a bearer token; retries once on 401. */
export async function googleFetch(url, options = {}, { calendar } = {}) {
  let token = await getToken({ calendar });
  let res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await identity.removeCachedAuthToken({ token });
    token = await getToken({ calendar });
    res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) {
    const err = new Error(`Google API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function signIn() {
  const token = await getToken({ interactive: true, calendar: false });
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not read Google profile');
  const info = await res.json();
  const account = { email: info.email, name: info.name, givenName: info.given_name, picture: info.picture };
  setDevice({ account });
  if (!prefs().name && info.given_name) setPrefs({ name: info.given_name });
  return account;
}

export async function connectCalendar() {
  if (!getDevice().account) await signIn();
  await getToken({ interactive: true, calendar: true });
  setDevice({ calendarConnected: true });
}

export function disconnectCalendar() {
  setDevice({ calendarConnected: false });
}

export async function signOut() {
  try {
    const token = await getToken({ interactive: false });
    if (token) {
      await identity.removeCachedAuthToken({ token });
      // Revoke so the next sign-in shows the account chooser again.
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
    }
  } catch {
    /* already signed out */
  }
  await identity.clearAllCachedAuthTokens?.();
  setDevice({ account: null, calendarConnected: false, sync: { fileId: null, lastSyncedAt: 0 } });
}
