# Inspira 2.0

**Your day, every time you open a new tab.**

Inspira replaces Chrome's New Tab page with a calm clock, daily inspiration and weather, with a quiet personal workspace for your day: tasks, notes, projects and Google Calendar.

- **Four modes, one key each.** `1` Clock · `2` Motivation · `3` Focus · `4` Plan
- **The date is the backbone.** Every task, note and event belongs to a day. Use `←` / `→` to move between days, `T` for today and `C` for the month calendar.
- **Three things stay separate.** *Schedule* is what's booked (Google Calendar, read-only). *Tasks* are what you need to do. *Notes* are what you want to remember.
- **Works without an account.** Signing in with Google syncs everything through a private file in your Drive.

---

## Run it locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open a new tab.

No build step and no dependencies. The code is plain ES modules.

```bash
npm test         # unit tests (node --test, no deps)
npm run serve    # optional: serve at http://localhost:5173/newtab.html (Google features disabled)
npm run zip      # package for the Chrome Web Store
```

## Enable Google sign-in, sync and Calendar

Google auth goes through `chrome.identity`, which needs an OAuth client tied to the extension's ID.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API** and **Google Calendar API**.
2. Set up the **OAuth consent screen**. Add the scopes `userinfo.email`, `userinfo.profile`, `drive.appdata` and `calendar.readonly`.
3. Go to **Credentials → Create OAuth client ID → Chrome Extension**. For the item ID, use the Web Store ID (`pemhabmgjkpbjdcedbfilpglbbklnmck`). For local testing, use the ID shown on `chrome://extensions`.
4. Put the client ID in `manifest.json` → `oauth2.client_id`.

Until then, the app shows "Google sign-in isn't configured" and everything else works locally.

> `calendar.readonly` is a **sensitive** scope. Public users won't see a clean consent screen until Google verifies the app, which typically takes a few weeks. Start that process early.

## Architecture

```
manifest.json          MV3, newtab override, service worker
newtab.html            shell; src/paint.js sets theme before first paint
background.js          reminders + focus-end notifications via chrome.alarms
src/
  app.js               bootstrap, stage per mode, 1s ticker (clock, focus, midnight rollover)
  core/
    store.js           single store: data (synced) · device (local) · ui (ephemeral)
    dates.js           day keys ('YYYY-MM-DD'), formatting, month grid
    merge.js           record-level last-write-wins + tombstones (sync)
    quickadd.js        "Review designs #work !! @4pm" parser
  services/
    storage.js         chrome.storage.local (falls back to localStorage)
    auth.js            chrome.identity, incremental scopes
    sync.js            Drive appDataFolder: pull → merge → push, debounced
    calendar.js        Calendar API, month-at-a-time cache
    weather.js         Open-Meteo (no key), city search / geolocation
  ui/                  small components built with h() + reactive()
  data/quotes.js       100 original lines across 5 categories
  styles/              tokens.css → base.css → app.css
```

**Rendering.** There's no framework. `h()` builds DOM, and `reactive(container, render)` re-renders a region when the store changes. It waits while you're typing inside that region, so inputs never lose focus. Time-based text (clock, countdown, greeting) updates in place through `data-bind` attributes instead of re-rendering.

**Data model.** Tasks: `{ id, title, date, time, priority 0–3, projectId, reminder, done, doneAt, createdAt, updatedAt, deleted }`. Notes: `{ id, title, body, date, projectId, … }`. Projects: `{ id, name, color, order, … }`. `date: null` means the item lives only in its project.

**Sync.** Local storage is the source of truth. When you're signed in, one JSON file in Drive's hidden `appDataFolder` is the shared copy. Each sync pulls it, merges record by record (newest `updatedAt` wins; deletions are kept as tombstones for 30 days), then pushes. Syncs run 2.5 s after an edit, when the tab becomes visible, and every 5 minutes. There's no server to run or pay for.

**Permissions.** `storage`, `identity` and `alarms` produce no install warning. `notifications` is *optional*: Inspira requests it only when you first set a reminder or start a focus session. Weather uses city search or a one-off browser geolocation prompt, so the manifest doesn't need `geolocation`. This is deliberate: when an update adds permissions that show a warning, Chrome disables the extension for existing users until they approve.

## Keyboard

| Key | Action |
| --- | --- |
| `1`–`4` | Clock · Motivation · Focus · Plan |
| `←` `→` | Previous / next day |
| `T` | Today |
| `C` | Calendar |
| `P` | Projects |
| `N` | New task |
| `M` | New note |
| `Q` | Another quote |
| `Space` | Start / pause focus |
| `D` | Cycle theme |
| `,` | Settings |
| `?` | Shortcuts |
| `Esc` | Close |

Quick-add tokens: `#project`, `!`/`!!`/`!!!` (priority), `@6pm` or `@18:30` (time).

## Credits

Inter typeface by Rasmus Andersson (SIL OFL 1.1, `src/fonts/Inter-LICENSE.txt`). Weather by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).
