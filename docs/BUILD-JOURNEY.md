# Inspira 2.0: the build journey

How Inspira went from a quote-only new tab to a calm personal daily workspace, and then to a Chrome Web Store launch with a video, store listing and ad creatives. It covers what was asked, what was built, the decisions behind it, what broke and how it was fixed.

> **Designed & developed by Neelesh** · [neelesh.one](https://neelesh.one) · [LinkedIn](https://www.linkedin.com/in/nkchaudhary01/)
> Built across 26–29 September 2026 in pair-programming sessions with Claude Code (AI coding agent), directed through prompts, screenshots, Figma links and comments on a live preview.

---

## At a glance

|                    |                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Product**        | Inspira — Your Day, Every New Tab (Chrome extension, Manifest V3)                                   |
| **Replaces**       | Inspira Quote Dashboard (existing Chrome Web Store item)                                            |
| **Promise**        | Calm + beautiful + minimal + personal · _plan, capture, focus, remember_                            |
| **Stack**          | Vanilla ES modules, no build step, no dependencies. HTML, CSS and JS only                           |
| **Size**           | ~6,500 lines of JS and ~5,400 lines of CSS across 40 source files (36 JS, 4 CSS)                    |
| **History**        | 53 commits on `claude/inspira-2-daily-workspace-5syb9c`                                             |
| **Tests**          | 43 unit tests (`npm test`) and a 23-check end-to-end run of the real unpacked extension             |
| **Permissions**    | `storage`, `alarms`; `notifications` and four calendar hosts are optional and requested only on use |
| **Privacy policy** | https://nkchaudhary-1.github.io/Inspira/privacy.html                                                |

---

## 1. The brief

The starting point was a long, specific brief to **evolve** Inspira, not replace it:

- **Keep the identity.** Large clock, date, inspirational quotes with categories, focus mode, light/dark, animations and keyboard shortcuts all stay.
- **Add a personal daily workspace around it:** tasks, daily notes, projects, calendar-based planning, Google Calendar, weather and sync.
- **The default tab must not look like a productivity app.** Time, date, a line of inspiration and weather come first; the workspace is secondary.
- **Not a Notion clone, not a Google Calendar clone, not a SaaS dashboard.**
- **The date is the backbone.** Every task, note and event belongs to a day, with previous, next and today navigation plus a picker.
- **Keep three things separate.** _Calendar_ is what's scheduled, _tasks_ are what I need to do, _notes_ are what I want to remember.
- **Modes:** Clock, Motivation, Focus and Planning, behind a very subtle switcher.
- **Tasks must be instant.** Click "+ Add task", type, press Enter, done. Optional date, time, priority, project and reminder.
- **Projects stay lightweight** groupings of tasks and notes.
- **Weather is subtle,** and the background can shift with the time of day.
- **Google login** to sync tasks, notes, projects and preferences.

---

## 2. How the work was done

The same loop repeated throughout:

1. **Ask:** a short request, often with a screenshot, a Figma frame link or a comment left on the live preview page.
2. **Build:** changes in the repo, reusing the existing design tokens and components.
3. **Verify:** Playwright loads the real extension headlessly and screenshots the result in light and dark mode at several widths; unit tests run; the change is checked against Chrome Web Store rules.
4. **Show:** a live preview published as a shareable page (demo data, runs in any browser), plus screenshots.
5. **Ship:** one focused commit per request, pushed to the working branch.

Inputs used along the way:

- **Figma:** the _Inspira 2.0_ design file (Clock, Daily Quote, Pomodoro, Tasks and Calendar frames, light and dark themes, navigation), the _Weather Icons Kit_ community file, and _My Icon Library_ (dock icons).
- **Screenshot references:** Dribbble-style references for the settings panel, project cards and gradient themes.
- **Marketing references:** a Pinterest video (motion reference), the _RDL Design Style_ guide (video styling) and Apple keynote visuals (store screenshots).

---

## 3. Timeline

### Phase 1 · Foundation (26 Sep, morning)

- **Brief → first build.** A complete MV3 new-tab extension:
  - Clock, date, weather (Open-Meteo, no API key), quotes with categories, focus timer, tasks, notes, projects.
  - Day/week/month calendar, keyboard shortcuts.
  - A store with local persistence, plus Google sign-in, Drive sync and Calendar scaffolding.
  - A published preview with sample data.
- **"Use Inter Display"** (preview comment): display type for the clock.

### Phase 2 · Navigation and the Figma screens

- **"Make navigation like a MacBook dock that hides and only appears when hovering a 3-dot icon."** The mode switcher became an auto-hiding glass dock behind a faint ••• handle, with number keys 1–5 as the fast path.
- **Implemented the Figma Clock frame,** then removed the Today task panel from Clock mode to keep it calm.
- **Implemented five Figma screens:** Clock, Daily Quote, Pomodoro (dot-matrix timer), Tasks (week board with drag between days) and Calendar (Day/Week/Month/Year).

### Phase 3 · Themes and responsiveness

- **Theme settings:**
  - Texture, grid and WebGL shader controls. The shader runs at half resolution and 30 fps, and pauses when the tab is hidden.
  - A "Shades of gray" palette for light and dark.
  - Responsive breakpoints at 1100, 900 and 600 px.
- **Dock polish** from preview comments: smoother animation, a more visible handle, then no genie or scale effect.
- **Laws of UX** added to Daily inspiration (30 laws with summaries and links).

### Phase 4 · Tasks, made fast

- **Tasks:**
  - Several tasks per day; multi-line paste adds one task per line.
  - Up to 10 tasks per day, enforced everywhere: typing, pasting, dragging, undoing a delete, carry-over.
  - The add-task field stays open on every day.
  - Delete from anywhere, with Undo.
- **Timer and quote:**
  - A mini Pomodoro timer on every page while it runs.
  - Bigger quote line and footer time.
  - AM/PM stays still when seconds are on.
- **Calendar:** month days open a popover in place.
- **Speed pass:** theme applied before first paint, and re-renders skipped when their data hasn't changed.

### Phase 5 · A modern look

- **Adopted the Figma light and dark themes.**
- **"The themes look very old school."** Rebuilt as modern backgrounds (halo, horizon, mesh, spotlight) with a reorganised Settings.
- **Sky:** time-of-day gradient backgrounds (dawn, day, evening, night and more) that also drive the accent colour. Sky became the default.
- **Dock and panels:**
  - The dock restyled as the Figma navigation.
  - Settings as a floating glass panel.
  - Popovers in the same glass style.
- **Colour and fonts:**
  - Hover colours tinted per theme.
  - Borders and surfaces that sit on any background.
  - Only bundled Inter and Boldonse.
- **Year view** as a 4×3 grid.
- **First Chrome Web Store readiness pass:** a bundled privacy page, minimal permissions, and weather place names derived from the time zone.

### Phase 6 · One design system

- **"Make the entire design consistent."**
  - One radius scale.
  - One control-height scale (32/40/48).
  - One button family.
  - One segmented-control family.
  - One caption style with sentence-case headings.
  - The same glass and shadow on all floating chrome.
  - Font sizes snapped to the type scale.
- **"Clean up and optimize the code."** Dead variants and tokens removed; hidden tabs skip DOM work and weather polling.
- **"Increase corner radius to all similar boxes"** (preview comment).
- **Redesigned background swatches:** each one is a tiny new tab with a clock and dock.
- **Weather icons** from the Figma kit everywhere, a new "Follow time of day" picker, and grouped settings controls.
- **Cleaner task cards:** a soft hover card, even padding, and a glass pill for actions.

### Phase 7 · Data you can trust

- **"Will these functions work? Will they store data?"**
  - Verified end to end: persistence across restarts and live updates between tabs.
  - Added a flush of pending saves when a tab is hidden or closed.
- **"Any easier alternative to Google login?"** → **"Cool, implement this."** See §5.
  - **Sync through Chrome** (`chrome.storage.sync`): no account and no server; your data follows your Chrome profile.
  - **Private iCal link:** Google Calendar, Outlook and iCloud events without OAuth.
- **"What happens on another device?"** Explained that the same Chrome profile with sync on brings the data along.

### Phase 8 · Projects, inputs, icons, colour

- **"The Projects page looks boring."**
  - Tinted cards per project colour, search, and a "new project" card.
  - A detail view with a breadcrumb.
  - Smooth directional page transitions using View Transitions.
- **Every input field** in one modern box style.
- **Dock icons** from _My Icon Library_ (filled style).
- **Custom background colour:** swatches, a picker and a hex field, with accessible contrast. Also fixed grid lines showing through panels and removed the scrim behind Settings.
- **"Fix spacing smartly everywhere including settings."** Everything moved onto the 4px spacing scale, and Settings keeps its scroll position.

### Phase 9 · Calendar polish, security and credits

- **Month view:** task lines removed, a count badge added bottom-right, larger text.
- **Final check:**
  - Performance: first paint ≈76 ms, ready ≈130 ms.
  - Security hardening: see §7.
  - Chrome Web Store guidelines.
- **About Inspira** in Settings: "Designed & developed by Neelesh", with portfolio and LinkedIn links.
- **Calendar Day view** as three soft cards: Schedule, Tasks, Notes.

### Phase 10 · Brand

- **"Give me a logo idea."** Three directions were sketched: _Dawn i_, _New tab, new day_ and _Sky dial_.
- **"Use this logo"** (Neelesh's own mark: a dusk sun over a folder with the INSPIRA wordmark).
  - Exported at 16/32/48 px full-bleed, and at 128 px with the store's recommended padding.
  - A 96 px version for the About card.
  - The 1024 px source is kept in the repo but excluded from the zip.

### Phase 11 · Real-browser testing

- **Step-by-step manual test guide:** load unpacked, what to check, and how to debug.
- **"Run and test via browser extension."** A 23-check end-to-end run of the real extension:
  - Install and every view.
  - Clicking to add, complete and delete tasks.
  - Live updates between two tabs.
  - Settings, a calendar link (with an unsafe link rejected), Chrome sync writes.
  - A browser restart, and a simulated second computer.
  - It **found a real bug:** an edit made in the tenth of a second before a hard browser quit was lost. Fixed by saving a lone edit immediately and batching only rapid typing. 23/23 then passed.
- **"Load in my browser."** Delivered `inspira.zip` with install steps.

### Phase 12 · Launch assets

- **"What other features can I build?"** A prioritised roadmap (see §10).
- **Feature intro video** from the Pinterest reference (see §8).
  - First version: dusk kinetic typography.
  - Then **"Use RDL theme"**, restyled with the _RDL Design Style_ guide (Glass style, Volt accent).
  - Then a **vertical 9:16 cut**.
- **"Why am I seeing the bottom customisation bar?"** It's Chrome's own footer for extension new tabs. It can't be removed from code; users hide it via _Customise Chrome → Show footer_.
- **Web Store listing:** name, summary, description, category, single-purpose statement, permission justifications and data disclosures (see §9).
- **Five screenshots** styled "like an Apple event", plus the **small promo tile** and **marquee**.
- **Privacy policy URL:** hosted on GitHub Pages from the repo (verified the deploy succeeded).
- **Store submission error** ("certify your data usage"): the three certification checkboxes on the Privacy practices tab.

### Phase 13 · Motion polish pass on the video

- **"Do not redesign it; treat this as a professional motion-design polish pass."** It started with a frame-by-frame audit, then the fixes (see §8.4).

---

## 4. Architecture

```
manifest.json      MV3 · new-tab override · strict CSP · minimal permissions
newtab.html        shell; src/paint.js applies the theme before first paint
background.js      service worker: task reminders + focus-end notifications (chrome.alarms)
privacy.html       bundled privacy policy (also served on GitHub Pages)
src/
  app.js           bootstrap, one stage per mode, 1s ticker (clock, pomodoro, midnight rollover)
  paint.js         cached theme → no flash on open
  core/
    store.js       single store: data (synced) · device (local) · ui (ephemeral); debounced saves + flush on hide
    merge.js       record-level last-write-wins with tombstones (safe multi-tab / multi-device merge)
    sanitize.js    cleans everything that arrives from outside: safe ids, http(s)-only links, hex colours, size caps
    syncPack.js    packs data into chrome.storage.sync's 100 KB / 8 KB-per-item quota
    ics.js         iCal parser: time zones, all-day, RRULE (daily/weekly/monthly/yearly), EXDATE, RECURRENCE-ID
    quickadd.js    "Review designs #work !! @4pm" → project, priority, time
    dates.js, ids.js
  services/
    storage.js     chrome.storage.local (localStorage fallback for the preview)
    chromeSync.js  sync through the Chrome profile
    calendar.js    iCal link source (Google Calendar API kept for later)
    weather.js     Open-Meteo, city search or rounded location
    auth.js, sync.js   optional Google sign-in + Drive sync (disabled in the shipped build)
  ui/              h() DOM builder + reactive() re-render helper; one module per surface
    dock, hero, focus, tasksPage, tasks, calendarPage, schedule, notes, projects,
    settings, overlay, backdrop, theme, shortcuts, weatherIcons, navIcons
  styles/
    tokens.css     primitives → semantic → component tokens
    app.css, base.css, privacy.css
  data/            quotes (6 categories) + 30 Laws of UX
tests/             node --test unit tests (43)
docs/              PRODUCT.md (product decisions) · BUILD-JOURNEY.md (this file)
```

**Key mechanics**

- **Store:** three slices.
  - `data` holds tasks, notes, projects and prefs; it's the part that syncs.
  - `device` holds per-browser state: mode, focus timer, location, calendar link.
  - `ui` holds ephemeral state.
  - Changes are saved to `chrome.storage.local`. Other tabs merge them live through `storage.onChanged`.
- **Rendering:** `reactive(container, render, deps)` skips work when its inputs haven't changed, and defers re-rendering while you're typing inside it.
- **Modes:** Clock · Quote · Focus · Tasks · Calendar on keys 1–5, with a hidden dock for the mouse.

---

## 5. Key decisions and trade-offs

| Decision                                              | Why                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No framework, no build step**                       | Instant load on every new tab, a tiny package (~265 KB zip), nothing to maintain.                                                                                                                                                                                                                                               |
| **Chrome sync + iCal link instead of Google sign-in** | Google OAuth needs a registered client ID, and `calendar.readonly` is a _sensitive_ scope that takes weeks of Google verification. Chrome sync gives "my tasks on every computer" with no account or server; a private iCal link gives calendar events with no OAuth. The Google code stays in the repo, documented, for later. |
| **Only whole records sync**                           | `chrome.storage.sync` holds 100 KB. Open tasks and the last 60 days sync; older items stay local. A truncated record could overwrite a complete one elsewhere, and "missing" is never treated as "deleted".                                                                                                                     |
| **10 tasks per day**                                  | Keeps each day honest and the board calm; enforced on every path that adds or moves a task.                                                                                                                                                                                                                                     |
| **Sky as the default background**                     | The page changes with the time of day, so it feels alive without widgets; the accent colour follows it.                                                                                                                                                                                                                         |
| **Workspace always secondary**                        | Clock mode shows only date, quote, clock and weather. Productivity lives one key away.                                                                                                                                                                                                                                          |
| **Optional permissions, one host at a time**          | The listing asks for nothing it doesn't use.                                                                                                                                                                                                                                                                                    |
| **Extension name**                                    | The full "Inspira — Your Day, Every New Tab" helps store search but makes Chrome's footer bar long. Open question: rename to "Inspira" and keep the tagline in the store summary.                                                                                                                                               |

---

## 6. Design system

- **Tokens in layers:** primitives → semantic roles → component tokens. Components never use raw values.
- **Scales:**
  - Spacing: 4px steps (`--space-1…16`).
  - Radius: sm, md, lg, xl, 2xl, pill.
  - Control heights: 32/40/48.
  - Type: `--text-2xs…3xl`.
- **Glass:** one recipe for every floating surface (dock, settings, popovers, toasts, mini timer), with one `--float-shadow`.
- **Backgrounds:**
  - None, Halo, Horizon, Mesh, Spotlight, Sky (time-of-day phases) and a custom colour.
  - Optional texture, grid and WebGL shader.
  - The accent is derived from the active background, with AA contrast.
- **Type:** bundled Inter Variable for UI and Boldonse for the clock. No web fonts are fetched.
- **Icons:** Weather Icons Kit (mono) and My Icon Library (filled) from Figma, exported as inline SVG.

---

## 7. Security, privacy and store compliance

- **Content Security Policy:** `script-src 'self'`, no remote code, and `connect-src` limited to Open-Meteo and the four calendar hosts.
- **Everything external is sanitised** (`sanitize.js`) before it's stored or rendered:
  - Record ids are checked (no `__proto__`).
  - Only `http(s)` links are kept, so a `javascript:` link in a calendar feed is neutralised.
  - Colours must be hex; text lengths are capped.
- **Permissions:** `storage` and `alarms` only. `notifications` and the calendar hosts are optional and requested at the moment of use.
- **No analytics, ads or tracking.** Weather sends only the chosen city, or a location rounded to about 100 m.
- **Privacy policy:** bundled and hosted at https://nkchaudhary-1.github.io/Inspira/privacy.html
- **Verified:** zero CSP violations across every page in the end-to-end run.

---

## 8. The feature intro video

### 8.1 Reference analysis

The Pinterest reference (29 s, kinetic typography) was broken into contact sheets and scene cuts. Its patterns:

- Words reveal one at a time in a sans + italic-serif mix.
- Black canvas with a soft glow, and blur-in/blur-out transitions.
- A logo reveal and a bento grid of feature tiles.
- A giant blurry word that sharpens.
- Floating cards, and letters that scatter and reassemble.

### 8.2 How it's made

- **Real product footage:** the unpacked extension driven with sample data, captured at 2× (clock, focus, tasks, projects, calendar, settings).
- **Animation:** one HTML page holds the whole timeline as a pure `render(t)` function. Playwright renders it frame by frame (1,155 frames at 30 fps) and ffmpeg encodes H.264.
- **Soundtrack:** an original score synthesised in code (warm pad, arpeggio, whooshes on cuts, low swells on logo reveals), so there are no licensing issues. Normalised to −14 LUFS.

### 8.3 Versions

1. **Dusk version:** Inspira's dusk palette with serif accents. 16:9, 38.5 s.
2. **RDL version:** restyled to the _RDL Design Style v2_ guide.
   - Ink canvas with an Ocean aura.
   - Light Urbanist type with one heavy word.
   - Glass panes and a single Volt accent.
   - Instruments: a tick ruler with a gliding needle, a dot-matrix (Doto) timer, and status shown as a dot plus a word.
3. **Vertical 9:16 cut:** re-laid out for portrait, with the bottom caption and button overlay zone kept clear.

### 8.4 Motion polish pass

The polish started with a frame-by-frame audit: every frame compared with the one before (spikes mean jumps, flat stretches mean start-stop-start), plus full-resolution alignment checks. Fixes:

- **Motion system:** named easing curves, each used for one job:
  - UI entry: controlled deceleration.
  - Settle: a whisper of overshoot.
  - Exit: accelerates away.
  - Cinematic: in-out for big moves and morphs.
  - Glide: for needles.
  - Keyframed motion uses a smooth spline, so it never stops at a key.
- **No start-stop:** every scene has a slow forward camera creep, and the grid's camera is one continuous move that pushes into Tasks.
- **Connected transitions:**
  - The big "Plan" morphs into the heading's "Plan" and becomes that word.
  - The highlight pill grows with round caps intact, revealing ink text with the same edge.
  - The theme toggle's knob colours the text it passes over.
- **Layout:**
  - One corner radius with nested insets.
  - Numerals on a shared baseline and status lines at one height.
  - The logo lockup optically centred.
  - The timer colon matched to the digit dots.
  - Symmetric sync arc and consistent heading positions.
- **Choreography:** primary motion finishes before secondary begins (the logo settles, then the wordmark rises), and every exit completes before its scene is removed.
- **Results:**
  - Abrupt jumps inside scenes: 3 → 0.
  - Start-stop holds: 4 → 0.
  - Worst change at a dark scene cut: 6.3 → 1.4.
  - Light/dark flashes: 37 → 14 (now a dissolve).

---

## 9. Chrome Web Store submission

| Field          | Value                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Name           | Inspira — Your Day, Every New Tab                                                                                                            |
| Summary        | A calm new tab with your whole day in it: clock, weather, tasks, focus timer and calendar. No account needed.                                |
| Category       | Productivity                                                                                                                                 |
| Single purpose | Replaces Chrome's new tab page with a personal day view: a clock, weather and quote, plus the user's tasks, notes, focus timer and calendar. |
| Data disclosed | Location only (the weather city or rounded coordinates, sent to Open-Meteo)                                                                  |
| Certifications | All three ticked (no selling, no unrelated use, no creditworthiness use)                                                                     |
| Remote code    | No                                                                                                                                           |
| Privacy policy | https://nkchaudhary-1.github.io/Inspira/privacy.html                                                                                         |

**Images:**

- Icon: 128 px.
- Five 1280×800 screenshots in the Apple-keynote style:
  1. _Your day. Every new tab._
  2. _Plan the week._
  3. _Focus, deeply._
  4. _Your whole day, at a glance._
  5. _Make it yours. Keep it private._
- Small promo tile: 440×280.
- Marquee: 1400×560.

**Package:** `npm run zip` → `inspira.zip`.

---

## 10. What's next

**Before or right after launch**

- Decide whether to rename the manifest `name` to "Inspira" so Chrome's footer bar reads cleanly.
- Make a 16 px toolbar icon without the wordmark; the text isn't legible at that size.
- Rebuild the zip from the latest commit before each upload.

**Roadmap ideas** (in priority order)

1. **Recurring tasks** using quick-add syntax like `every mon`, reusing the iCal recurrence engine.
2. **A project detail page** as a real container for its tasks and notes.
3. **Focus time per project,** shown as a small weekly stat.
4. **A searchable notes archive.**
5. **Several calendar links,** each with its own colour.
6. **A weekly review** on Sundays.
7. **A command palette** (⌘K).
8. **A global quick-capture shortcut.**

**Deliberately not planned:** streaks and gamification, and a widget sprawl of stocks, news and bookmarks. Both would break the calm.

---

## 11. Where things live

| What                                                          | Where                                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Extension source                                              | this repo, branch `claude/inspira-2-daily-workspace-5syb9c`                                                                                |
| Product decisions                                             | `docs/PRODUCT.md`                                                                                                                          |
| Privacy page                                                  | `privacy.html` (+ GitHub Pages)                                                                                                            |
| Logo source                                                   | `icons/icon-source.png` (1024 px, excluded from the zip)                                                                                   |
| Store package                                                 | `npm run zip` → `inspira.zip`                                                                                                              |
| Videos, store screenshots, promo tiles and their HTML sources | produced in the build session's temporary workspace and delivered as downloads. They are **not** in this repo; keep the downloaded copies. |

---

## 12. Running it

```bash
# Load in Chrome
chrome://extensions → Developer mode → Load unpacked → select this folder → open a new tab → "Keep it"

npm test        # 43 unit tests (node --test, no dependencies)
npm run serve   # preview at http://localhost:5173/newtab.html (Chrome-only features disabled)
npm run zip     # package for the Chrome Web Store
```
