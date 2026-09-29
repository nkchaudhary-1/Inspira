# Inspira 2.0

**Your day, every time you open a new tab.**

Inspira replaces Chrome's New Tab page with a calm clock, daily inspiration and weather, plus a quiet personal workspace: a pomodoro timer, a week task board, and a calendar with notes, projects and Google Calendar.

- **Five modes, one key each.** `1` Clock · `2` Quote · `3` Focus (pomodoro) · `4` Tasks (week board) · `5` Calendar (day / week / month / year)
- **The date is the backbone.** Every task, note and event belongs to a day. Drag tasks between days, step through weeks or months with `←` / `→`, and jump back with `T`.
- **Three things stay separate.** _Schedule_ is what's booked (Google Calendar, read-only). _Tasks_ are what you need to do. _Notes_ are what you want to remember.
- **Works without an account.** Data syncs through your Chrome profile (`chrome.storage.sync`) to every computer signed in to Chrome with sync on, and your calendar comes from a private iCal link (Google, Outlook or iCloud). Google sign-in is optional, for later.

**Docs:** [Product & design decisions](docs/PRODUCT.md) · [Build journey: how Inspira 2.0 was made](docs/BUILD-JOURNEY.md)

---

## Theme

Settings → **Theme** controls the look behind every mode:

- **Mode:** Auto / Light / Dark, built on a "Shades of gray" palette: `black-100…60` (#0A0E15 → #667085) and `white-100…60` (#FFFFFF → #BFC6D4). Text roles: header = white-100 / black-100, description = white-80 / black-80.
- **Presets:** Minimal, Grain, Paper, Dot grid, Blueprint, Aurora, Mesh and Waves.
- **Texture:** none / grain / paper / static, with an amount slider.
- **Grid:** none / dots / lines / blueprint, with size and opacity sliders. It fades out at the edges.
- **Shader:** none / aurora / mesh / waves, a WebGL fragment shader tinted with the palette, with intensity and speed sliders. It renders at half resolution, is capped at 30fps, pauses in hidden tabs and stays still under reduced motion.

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

## Sync and calendar without an account

- **Chrome sync** (Settings → Account → Sync with Chrome, on by default). Uses `chrome.storage.sync`: about 100 KB, 8 KB per item. `src/core/syncPack.js` packs prefs, projects, open tasks and the last 60 days of items (newest first, whole records only) into chunks; whatever doesn't fit stays local, and the record-level merge never treats "missing" as "deleted". Writes are batched every 3 s.
- **Calendar link** (Settings → Account → Calendar). Paste a secret iCal link; `src/core/ics.js` parses it (time zones, all-day, recurring events, exceptions). Hosts are optional permissions requested one at a time: `calendar.google.com`, `outlook.office365.com`, `outlook.live.com`, `*.icloud.com`. The link is stored on this device only.

## Optional: Google sign-in (Drive sync, Calendar API)

The shipped build doesn't include Google sign-in (no `identity` permission, no OAuth client), so the Web Store listing asks for nothing it doesn't use. The code is kept in `src/services/auth.js` / `sync.js`; to turn it on, add `"identity"` to `permissions` and an `oauth2` block to `manifest.json`, then:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API** and **Google Calendar API**.
2. Set up the **OAuth consent screen**. Add the scopes `userinfo.email`, `userinfo.profile`, `drive.appdata` and `calendar.readonly`.
3. Go to **Credentials → Create OAuth client ID → Chrome Extension**. For the item ID, use the Web Store ID (`pemhabmgjkpbjdcedbfilpglbbklnmck`). For local testing, use the ID shown on `chrome://extensions`.
4. Put the client ID in `manifest.json` → `oauth2.client_id` and add the sign-in section back to `privacy.html`.

Until then the Google account card stays hidden and everything else works without an account.

> `calendar.readonly` is a **sensitive** scope. Public users won't see a clean consent screen until Google verifies the app, which typically takes a few weeks. Start that process early.

## Architecture

```
manifest.json          MV3, newtab override, service worker
newtab.html            shell; src/paint.js sets theme before first paint
background.js          reminders + focus-end notifications via chrome.alarms
src/
  app.js               bootstrap, stage per mode, 1s ticker (clock, pomodoro, midnight rollover)
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
    tasksPage.js       Tasks mode: week board, inline add, drag between days, projects
    calendarPage.js    Calendar mode: day workspace / week / month grid / year
    focus.js           Focus mode: pomodoro cycle + dot-matrix display
    dock.js            hidden macOS-style dock
    backdrop.js        theme texture / grid (CSS) + WebGL shader
  data/quotes.js       100 original lines across 5 categories
  styles/              tokens.css → base.css → app.css
```

**Rendering.** There's no framework. `h()` builds DOM, and `reactive(container, render)` re-renders a region when the store changes. It waits while you're typing inside that region, so inputs never lose focus. Time-based text (clock, countdown, greeting) updates in place through `data-bind` attributes instead of re-rendering.

**Data model.** Tasks: `{ id, title, date, time, priority 0–3, projectId, reminder, done, doneAt, createdAt, updatedAt, deleted }`. Notes: `{ id, title, body, date, projectId, … }`. Projects: `{ id, name, color, order, … }`. `date: null` means the item lives only in its project.

**Sync.** Local storage is the source of truth. When you're signed in, one JSON file in Drive's hidden `appDataFolder` is the shared copy. Each sync pulls it, merges record by record (newest `updatedAt` wins; deletions are kept as tombstones for 30 days), then pushes. Syncs run 2.5 s after an edit, when the tab becomes visible, and every 5 minutes. There's no server to run or pay for.

**Permissions.** `storage` and `alarms` produce no install warning. `notifications` is _optional_: Inspira requests it only when you first set a reminder or start a focus session. Weather uses city search or a one-off browser geolocation prompt, so the manifest doesn't need `geolocation`. This is deliberate: when an update adds permissions that show a warning, Chrome disables the extension for existing users until they approve.

## Keyboard

| Key     | Action                                                               |
| ------- | -------------------------------------------------------------------- |
| `1`–`5` | Clock · Quote · Focus · Tasks · Calendar                             |
| `←` `→` | Previous / next week (Tasks) or day / week / month / year (Calendar) |
| `T`     | Today                                                                |
| `C`     | Calendar                                                             |
| `P`     | Projects                                                             |
| `N`     | New task for today                                                   |
| `M`     | New note for the selected day                                        |
| `Q`     | Another quote                                                        |
| `Space` | Start / pause the timer                                              |
| `R` `S` | Reset / skip the timer                                               |
| `D`     | Cycle theme                                                          |
| `,`     | Settings                                                             |
| `?`     | Shortcuts                                                            |
| `Esc`   | Close                                                                |

Quick-add tokens: `#project`, `!`/`!!`/`!!!` (priority), `@6pm` or `@18:30` (time).

## Credits

Inter typeface by Rasmus Andersson and Boldonse (both SIL OFL 1.1, see `src/fonts/`). Weather by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).

## Publishing to the Chrome Web Store

The package follows Manifest V3 and the Web Store program policies; `npm test` checks the parts that can be automated (MV3, name/description length, icons, minimal permissions, no remote code or inline scripts, network calls only to disclosed services, privacy policy coverage). Before submitting:

1. **Content security policy** — `manifest.json` pins scripts to the package (`script-src 'self'`, no eval), blocks plugins, framing and form posts, and limits network calls to Open-Meteo and the calendar hosts. `npm test` checks it.
2. **Untrusted data** — imported files, Chrome sync and calendar feeds pass through `src/core/sanitize.js` (known fields and types only, http(s) links only, hex colours only, size caps).
3. **Privacy policy URL** — `privacy.html` ships inside the extension; also publish it at a public URL and paste that into the listing.
4. **Permission justifications** (Privacy tab of the listing):
   - `storage` — saves tasks, notes, projects and settings on the device.
   - `alarms` — schedules focus-session ends and task reminders.
   - `notifications` (optional, asked on first use) — focus and reminder alerts.
   - `optional_host_permissions` (asked only when you paste a calendar link, for that one service) — read the private iCal feed.
   - No required host permissions; no remote code.
5. **Single purpose** — "Replaces the new tab page with a calm daily workspace: clock, inspiration, weather, focus timer, tasks and calendar."
6. **Data disclosure** — personal content syncs only through the user's own Chrome sync (or, if signed in, their Google Drive app folder); calendar events are read from the user's own iCal link; approximate location only for weather (Open-Meteo); not sold, not used for unrelated purposes, not used for creditworthiness.
7. **Package** — `npm run zip` builds `inspira.zip` with only what ships (no tests, docs or sources of icons).
8. **Listing assets** — 128×128 icon (included), at least one 1280×800 screenshot, 440×280 small promo tile.
