# Inspira 2.0 — product & design decisions

## Positioning

**Calm + beautiful + minimal + personal**, and useful: *plan, capture, focus, remember.*
The central guardrail: the default tab must not look like a productivity app. The workspace is always secondary to the time, the day and the line of inspiration.

## Identity: what carried over, and what's assumed

The original extension's source and store assets weren't available when this was built: the repo was empty and the Web Store is unreachable from the build environment. So the brief's list of concepts was carried forward: large clock, date, quotes with categories, focus mode, light/dark, animations and keyboard shortcuts. The visual language is a best-fit, "calm, minimal" interpretation of that list.

**Everything identity-specific lives in `src/styles/tokens.css` (Layer 1 primitives and type families).** To match the shipped Inspira exactly, swap:

- palette primitives (`--sand-*`, `--ink-*`, `--amber-*`)
- `--font-display` / `--font-serif` (and the bundled font file)
- `--clock-size` / `--clock-weight` / `--clock-tracking`
- the icon in `icons/`

Components only reference semantic and component tokens, so none of them need edits.

## Modes

Figma: *Inspira 2.0 — Home — Clock / Daily Quote / Pomodoro / Tasks / Calendar*.

| Mode | Job | What's on screen |
| --- | --- | --- |
| **Clock** (default) | Glance | Date, one quote line, a large Boldonse clock, weather — nothing else. |
| **Quote** | Pause | Greeting, the day's line set large in Boldonse, date + time + weather. Category, "another one" and copy appear on hover. |
| **Focus** | Do one thing | Pomodoro on a dot-matrix display: Focus / Short break / Long break (every 4th). Reset · Start · Skip, session pips, optional intention. Shared across tabs; a notification fires at the end. |
| **Tasks** | Plan the week | Seven day columns. "+ Add task" inline (stays open for rapid entry), drag a task onto another day, carry-over from earlier days. Projects is a tab. |
| **Calendar** | See time | Day (Schedule · Tasks · Notes — the old Plan mode), Week, Month (the Figma grid) and Year. Click any day to open it. |

Navigation lives in a hidden dock. A faint ••• handle at the bottom (or the very bottom edge of the screen, like macOS auto-hide) reveals a glass dock with the five modes plus shortcuts, theme and settings; icons magnify toward the pointer. Number keys are the fast path.

## Key decisions and tradeoffs

- **Three columns, not a merged list.** The brief says not to mix scheduled / to-do / remember. They share the date and nothing else. Events are colour bars with a time column; tasks are checkboxes; notes are cards.
- **Capture over configuration.** A task is text + Enter. Details (time, priority, project, reminder, date) live behind `⋯`. Power users get quick-add tokens (`#work !! @4pm`) without extra UI.
- **Unfinished work carries over, visibly.** Today's Tasks column shows "N unfinished from earlier · Move to today". Nothing moves on its own, so past days stay truthful.
- **Projects are labels.** A project has a name and a colour, nothing more: no statuses, boards or due-date math. A task with `date: null` lives only in its project.
- **Local-first, optional account.** The app works fully offline and without sign-in. Sign-in adds sync through a hidden Drive file, so there's no backend, no database bill and no data on anyone else's server.
- **Incremental Google scopes.** Sign-in asks only for profile + app-data. Calendar (a sensitive scope) is asked for only when the user connects it.
- **No new permission warnings on upgrade.** Notifications are optional and requested in context. Geolocation is a runtime prompt, not a manifest permission. Existing users won't get their extension disabled by the 2.0 update.
- **Weather is atmosphere.** A small readout plus a faint background tint by weather group, on top of a gradient keyed to time of day (dawn, morning, afternoon, evening, night).
- **Original quotes.** The 100 lines are original, attributed to "Daily Inspiration". This avoids the misattributed-quote problem common in quote apps. The daily pick is deterministic per date and category.

## MVP (this build) vs. later

**In the MVP**
- All four modes; light/dark/auto; atmosphere by daypart and weather
- Tasks: quick add, tokens, inline edit, details popover, reminders, carry-over, undo delete
- Notes: inline cards → inline editor, auto bullets, per-day or per-project
- Projects: create, rename, colour, delete (items kept)
- Date nav, month calendar with dots and agenda preview, keyboard shortcuts
- Google sign-in, Drive sync, read-only Google Calendar
- Export / import JSON

**Later**
- Create or edit Calendar events from Inspira (needs the `calendar.events` scope and more UI)
- Recurring tasks
- Drag to reorder tasks and to move them between days
- Custom quotes, favourites, a quote history
- Browsers without `chrome.identity.getAuthToken` (Edge, Brave): add a `launchWebAuthFlow` fallback
- Real-time sync (Drive changes API or a push channel) instead of pull-on-focus plus a 5-minute interval
- Onboarding: a 3-step first-run (name → weather → optional sign-in)

## Edge cases handled

- Midnight rollover: the clock and the selected day follow if you were on today.
- Editing in two tabs: storage changes merge instead of overwriting, and nothing re-renders while you’re typing.
- Calendar offline or token expired: cached events stay visible with a quiet retry.
- Deleting a project keeps its tasks and notes.
- An empty note is discarded when closed.
- Reduced motion: all motion collapses to instant.
