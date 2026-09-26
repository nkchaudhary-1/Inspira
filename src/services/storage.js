// Persistence adapter. chrome.storage.local inside the extension; localStorage
// when the page is opened outside Chrome (local preview / tests).

const chromeStore = typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;

export const isExtension = Boolean(chromeStore);

export async function load(key) {
  if (chromeStore) {
    const res = await chromeStore.get(key);
    return res[key] ?? null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function save(key, value) {
  if (chromeStore) return chromeStore.set({ [key]: value });
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — data stays in memory for this tab */
  }
}

/** Fires when another tab (or the service worker) writes a key. */
export function onExternalChange(callback) {
  if (chromeStore) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [key, { newValue }] of Object.entries(changes)) callback(key, newValue ?? null);
    });
    return;
  }
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    try {
      callback(e.key, e.newValue ? JSON.parse(e.newValue) : null);
    } catch {
      /* ignore malformed values */
    }
  });
}
