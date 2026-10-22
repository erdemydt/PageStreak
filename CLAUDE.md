# PageStreak

A reading-habit tracker (React Native + Expo) that is live on the App Store. Users log
reading sessions against books, build a daily-minutes streak, and grow their daily goal
week by week toward a target. All data is local (SQLite); the only network call is Open
Library book search. UI is bilingual: English and Turkish.

Most of this codebase was written by earlier models (Sonnet 3.5 / Opus 4). We are on a
multi-session journey to make it genuinely good, not only working. Keep this file current:
update the **Journey log** and **Known issues** at the end of every session that changes
something meaningful.

## Commands

```bash
npm start            # expo start (dev client; expo-dev-client is installed)
npm run ios          # expo run:ios (native build)
npm run android
npm run lint         # expo lint (eslint-config-expo). Keep it at 0 errors
npx tsc --noEmit     # typecheck (strict). Keep it clean
```

There is **no test framework**. Verify with `tsc` + `lint`, and after any change to `db/db.tsx` run
`scripts/db-migration-check/run.sh` (real SQLite files, the original app's schema, and the boot race). For pure logic (dates, streaks,
goal math), transpile the module with `typescript.transpileModule`, stub `db/db`, and run it
under several `TZ=` values (at least America/Los_Angeles, Europe/Istanbul, Pacific/Auckland).
Adding Jest for `utils/` is on the roadmap.

Stack: Expo SDK 54, React Native 0.81 (new architecture), React 19, expo-router 6 (typed
routes), expo-sqlite 16, i18next, Hermes.

## Map

```
app/
  _layout.tsx            Root stack + LanguageProvider; forwards AppState to NotificationService
  index.tsx              Boot: init DB → notification prefs → grow daily goal → route to intro/home
  intro.tsx              Onboarding: name (+ restore) → daily goal (presets) → grow it? (target, date, preview) →
                         reminder opt-in → saves user_preferences id=1 → optional first book (Add sheet). A plain
                         fade-in screen, not a native modal, so root-hosted sheets can present over it
  settings.tsx           Root screen pushed from the gear (Today, Progress): name, language, reminder, backup, About, erase
  (tabs)/
    (home)/index.tsx     Today (Folio): minutes vs goal + streak, week strip (→ readinglogs), the book read most
                         recently (switcher if several), Log reading / timer, today's sessions (tap → edit), yearly line
    (home)/readinglogs.tsx  Re-export of (progress)/history, so Today's week strip keeps Back on Today
    (books)/index.tsx    Library: search, status chips, sort sheet, long-press menu (status, delete), "+" → Add sheet
    (books)/my-books.tsx, search.tsx  Redirect stubs to the Library (Phase 8.3; remove after 2+ releases)
    (books)/[id].tsx     Book page: status line, stats, actions, its sessions, About; "…" menu (re-exported in (home)/book)
    (progress)/index.tsx Progress: streak, week strip + stats, daily-goal card (→ growth), year card (yearly-goal sheet)
    (progress)/growth.tsx   Growth Journey chart; GoalSheet is the only editor of daily/target goal and date
    (progress)/history.tsx  Sessions a week at a time; tap to edit, "+" logs on that day
    profile.tsx, reading-growth.tsx  Redirect stubs (hidden tabs; Phase 8.4; remove after 2+ releases)
components/              Screens' building blocks (intro/ holds the onboarding steps)
  today/                 Today's parts (WeekStrip)
  session/               SessionFields (log/edit sheet fields), SessionRow (one session in a list)
  book/                  AddBookSheet (Open Library + manual), LibraryRow, BookMenuSheet (page count, delete), FinishSheet
  progress/              GoalSheet (daily goal, target, target date)
  settings/              SettingsRow (hairline row), ReminderSettings (switch, mode, hours/time)
  ui/                    Folio primitives: Button, Sheet (the one bottom sheet), OptionSheet, FieldSheet, Chip, BookCover, Eyebrow, Hairline,
                         ProgressRule, StatRow, Screen, SettingsButton (the gear). Build new UI from these
contexts/
  SessionSheetsContext.tsx  Hosts the shared sheets once at the root: useSessionSheets().openLogger({bookId?, date?,
                         minutes?, onSuccess?}) / editSession(s) / celebrateFinish(bookId) / openAddBook({status?, closeOnAdd?})
db/db.tsx                SQLite handle, queryAll/queryFirst/execute, schema init
db/repos/                Data layer. Screens/components use ONLY these (lint-enforced):
  books.ts               addBook, listBooksWithStats, getBook, setPageCount, updateBookStatus, ...
  sessions.ts            logSession, updateSession, deleteSession, listSessionsWithBooks, daily totals
  preferences.ts         getUserPreferences, getDailyGoal, saveOnboardingPreferences, updateUsername, setYearlyBookGoal
  notificationPrefs.ts   Reminder settings row (read / ensure / write)
  appUsage.ts            App open/close tracking (times the "after I leave" reminder)
hooks/useFocusRefresh.ts Load on focus + on data-change events (+ optional deps)
hooks/useBookStatusChange.ts  The one way to change a status from UI (confirms leaving "read", finish sheet, toast)
types/models.ts          Row types (EnhancedBook, ReadingSession, UserPreferences, ...)
services/
  notificationService.ts Reminder entry point (facade): permissions, prefs, app-state lifecycle
  reminderScheduler.ts   Stateless scheduling (quiet hours, after-last-open, daily-time x7 days, message text)
  notificationDevTools.ts Dev-only test notifications/status
  dataBackupService.ts   JSON export/import (replace or merge)
  openLibrary.ts         Search API
utils/
  dateUtils.ts           Local-date helpers + parseDbDate (use these, see Gotchas)
  week.ts                Monday-first week dates, weekday labels, loadWeek (each day vs its own goal)
  readingProgress.ts     Session aggregates, streaks, page-progress sync
  bookStatus.ts          Status colors/labels + updateBookStatus / deleteBookWithSessions
  goalSettings.ts        Growth-goal validation and derived fields
  goalHistory.ts         Goal timeline: recordGoalChange, loadGoalForDate, backfill
  logger.ts              Dev-only log/warn
  readingTimer.ts        Home card timer (AsyncStorage timestamps: running / stopped)
  format.ts              formatDuration / formatDate in the app language (use these, no local formatters)
  dataEvents.ts          Change bus: repo writes emit books/sessions/preferences
  devData.ts             Dev-only random session generator
  toast.ts               showToast({message, actionLabel?, onAction?}): non-blocking feedback (ToastHost in root layout)
i18n/index.ts            ALL strings, `en` and `tr` in one file
themes/                  COLORS / SPACING / TYPE / FONTS tokens (use them; no raw hex in screens). Folio design
                         language: role tokens COLORS.paper/ink/line/accent/streak; legacy keys map onto them
```

## Data model (SQLite, `pagestreak.db`)

- `user_preferences`: single row, `id = 1`. Its existence means "user is onboarded".
  Goal fields: `initial_` / `current_` / `end_reading_rate_*_minutes_per_day`,
  `end_reading_rate_goal_date`, `weekly_reading_rate_increase_minutes`,
  `current_reading_rate_last_updated`. **`current_reading_rate_minutes_per_day` is the daily goal.**
- `enhanced_books`: `reading_status` ∈ `want_to_read | currently_reading | read`.
  `page` can be 0 when Open Library has no page count (user can fix it on the detail screen).
- `reading_sessions`: `book_id`, `minutes_read`, optional `pages_read`, `date` (local `YYYY-MM-DD`).
- `notification_preferences` (row id=1), `app_usage_tracking`, `database_version`.
- `goal_history`: `(effective_date TEXT PK, minutes)`, the daily goal over time. Backfilled from
  the growth plan for older installs, and included in backups.
- `weekly_progress`: **vestigial**. Nothing reads it any more; it's kept only for backup-format compatibility.
- No FK constraints: deleting a book must delete its sessions (`deleteBookWithSessions`).

Schema changes go through **versioned migrations** in `db/db.tsx` (`MIGRATIONS`, tracked by
`PRAGMA user_version`). To change the schema, append `{ version: N + 1, description, up }`; never edit,
reorder or remove a shipped migration. Each runs once, in a transaction with the version bump.
Migration 4 is the baseline (the old idempotent create/alter steps). It is safe for any earlier
install. The old `database_version` table is left in place but no longer used. "Erase all data"
(`utils/migration.ts#logoutUser`) deletes rows from `USER_DATA_TABLES` and keeps the schema, so add new user
tables there and to the backup service. Test migrations against real DB files: see the Journey log, Phase 5.

## Domain rules

- **Daily goal growth** (`utils/goalSettings.ts#applyWeeklyGoalGrowth`, run on cold start and on resume): linear,
  `+weekly_reading_rate_increase_minutes` per full week since `current_reading_rate_last_updated`,
  capped at the target, stops after the goal date. The new goal is recorded in `goal_history` as effective
  *today* (never back-dated: users must not be judged against goals they never saw). Preference and
  goal-history writes happen together in `db.withTransactionAsync`.
- **Streak** (`utils/readingProgress.ts#calculateStreaks`): consecutive local days, each meeting
  **the goal in effect that day** (`utils/goalHistory.ts`: `goal_history` table, one row per goal
  change). It stays alive through today. Any code that changes `current_reading_rate_minutes_per_day`
  **must** call `recordGoalChange`.
- **Page progress**: `current_page` is a cache of `SUM(pages_read)` over the book's sessions,
  capped at `page`; finished books are pinned to `page`. After any session insert, edit or delete,
  call `syncBookCurrentPageFromSessions(bookId)`.
- **Book writes** go through `db/repos/books.ts` (`addBook`, `updateBookStatus`, `deleteBookWithSessions`).
  Lists come from `listBooksWithStats` (one JOIN carrying `reading_time` and `pages_from_sessions`);
  `BookCard` derives progress from those props via `computeBookProgress`.
- **Goals** (daily/target minutes, target date) are edited only in Growth Journey (GoalSheet); the yearly goal on Progress;
  the name in Settings. Genres are still stored and backed up but have no UI
  (onboarding no longer asks; new rows store '').
- **Yearly goal** counts books with status `read` whose `date_finished` is in the current year. `yearly_book_goal = 0`
  means no goal (new users start there): Today hides the yearly line and Progress offers "Set a goal".
- **Session sheets**: never mount ReadingTimeLogger / EditSessionModal in a screen; call `useSessionSheets()`.
  The logger preselects `bookId` only if that book is currently being read, else the most recently read book.
  Status changes from UI go through `useBookStatusChange()`; marking a book read calls `celebrateFinish(bookId)`; when another sheet is closing, delay it ~450 ms
  (iOS can't present a modal while one is dismissing).
- **Reminder taps** land on Today (`NotificationService.onReminderTapped` in the root layout, `router.dismissTo` so Today
  isn't pushed twice), only for onboarded users and only after boot (`utils/boot.ts`; a launching tap is left to app/index.tsx).
- **Notifications**: a single reminder with the fixed identifier `daily-reminder`, scheduled only on
  `'background'` (never `'inactive'`) through a serialized queue. Schedule paths never prompt for
  permission. Two modes (`reminder_mode`): 'after_close' (N hours after leaving, outside quiet hours) or
  'daily_time' (DATE trigger at `reminder_time`, today if the goal is still open, else tomorrow). Permission is
  requested only in onboarding (opt-in switch) or from Settings, never at launch. No reminder if today's goal is met; reminders are pushed out of quiet
  hours (22:00–09:00); text comes from i18n (`settings.notificationMessages.*`), not the DB columns.

## Gotchas (read before touching dates, i18n, or data)

- **Never `new Date('YYYY-MM-DD')`**: it parses as UTC and shifts a day for users west of UTC.
  Use `parseLocalDateString` / `addDaysToDateString`, and `dateToLocalDateString` to format.
- **SQLite `CURRENT_TIMESTAMP` is UTC without a `Z`** (`YYYY-MM-DD HH:MM:SS`). Hermes may not
  parse it, and other engines read it as local time. Read any DB date with `parseDbDate`. Write new
  timestamps from JS with `toISOString()`.
- **i18n parity**: every key must exist in both `en` and `tr`. No hard-coded user-facing
  strings, including `Alert.alert` titles and buttons. Avoid i18next `_one`/`_other` plurals
  (Hermes `Intl.PluralRules` support is not guaranteed); use explicit keys like `bookCountOne` / `bookCountOther`.
- **Never export `unstable_settings.initialRouteName` from a tab stack layout.** With it, expo-router
  matches the launch URL `/` inside the tabs instead of `app/index.tsx`, so boot (onboarding, goal growth,
  `markBootComplete`) never runs. Don't navigate across tabs into a stack; give each tab its own route
  instead (Home opens books via `(home)/book/[id]`, which re-exports the Books detail screen).
- Tabs stay mounted: load screen data with `useFocusRefresh(load, topics, deps?)`, not `useEffect([])`.
  New writes belong in a repo and must `emitDataChange(...)` so visible screens refresh.
- Feedback: success → `showToast` (optionally with Undo); `Alert.alert` only for errors and decisions.
- Turkish copy uses the formal "siz" form consistently.
- **Uppercase with `toAppUpperCase` (utils/format.ts)**, never `textTransform: "uppercase"` or `toUpperCase()`:
  those turn Turkish "i" into "I" instead of "İ". `Eyebrow` already does it.
- No SQL in `app/` or `components/` (ESLint `no-restricted-imports`); add a repo function instead.
  `utils/` and `services/` may query, but prefer repos.
- Don't define components inside render (e.g. `const Header = () => …; <Header/>`); it remounts every render.
- Backup **merge** never writes by primary key; it remaps book ids and dedupes sessions.
- `utils/devMode.ts#ENABLE_DEV_FEATURES` gates dev tools (NotificationTester, random data). Keep it `false` in commits.
- Logging: use `log`/`warn` from `utils/logger.ts` (dev-only); `console.error` for real errors.
- **Transactions:** always `runInTransaction(task)` from `db/db.tsx`; never `db.withTransactionAsync`
  (overlapping calls on the shared connection corrupt each other: the second BEGIN fails and its ROLLBACK
  undoes the first transaction, which then continues in autocommit). Never nest `runInTransaction`.
- **Startup:** `initializeDatabase()` is memoized; the root layout renders nothing and ignores app-state
  events until it resolves, so even deep-link launches never touch an unmigrated DB. A failed init shows a
  retry screen (never onboarding, which would overwrite an existing profile).
- Backup import runs in `db.withExclusiveTransactionAsync`: every statement inside it must use `txn`
  (`runIn(txn, …)`); a global `execute` there fails with "database is locked".
- **Fonts:** Newsreader (serif: headings, numbers) and Inter (UI text), loaded in `app/_layout.tsx` from per-weight
  subpaths (`@expo-google-fonts/inter/500Medium`) so only those weights are bundled. Use `TYPE.*` / `FONTS.*`, which set
  `fontFamily` per weight; never put `fontWeight` on Folio text (iOS would fall back to the system font).
- Light mode is forced (app.json, Info.plist, Android theme) until real dark mode exists.

## Working agreement

- Fix root causes; prefer shared helpers over copy-pasted SQL (status-change SQL used to be copy-pasted across three screens).
- Match surrounding style: functional components, `StyleSheet.create` at the bottom, theme tokens, `t()` for text.
- User data is precious (real App Store users): never change behavior in a way that loses or
  rewrites existing rows without an explicit migration and a note here.
- Don't commit unless asked. Leave `tsc` and `lint` (0 errors) clean.
- **Shipping is the owner's call.** Never bump versions, prepare releases or submit builds unless
  explicitly asked. The owner tests on device when they decide to.
- Work proceeds **phase by phase** through ROADMAP.md. Claude implements each phase directly.
  Subagents are used only for isolated parallel chunks (in worktrees) and as a fresh-eyes reviewer
  of each phase's diff. Commit at the end of each phase.

## Known issues / roadmap (ranked)

**New session? Read the "▶ Start here" section at the top of ROADMAP.md first.**

The full phased plan lives in **ROADMAP.md**; work from it and tick items off there. Must-knows
from the audit: never run `expo prebuild --clean` (iOS builds from committed `ios/` via Xcode
Cloud), every change ships via an App Store release (no OTA), and bump the version in
`ios/PageStreak/Info.plist` directly (app.json `version` is ignored).

1. **Unverified unused i18n keys** (~70, e.g. `profile.stats.*`, `settings.hourOptions.*`,
   several `settings.*` notification labels). Some may be built dynamically; check before deleting.
   Unused npm deps are likely (`notifee`, `@expo/ngrok`, `react-native-permissions`, ...); removing them needs a native rebuild.
2. **No tests** (deliberately out of scope for now). Add Jest for `utils/` (dates, streaks, goal math) and the backup merge.
3. **Screens are huge** (700–1300 lines), with copy-pasted modal/animation code and inline queries.
   Extract a data layer (repositories/hooks) and shared modal primitives.
4. Remaining hard-coded English: dev-only `NotificationTester`, readinglogs random-data alerts,
   `DataImportModal` validation details, Open Library error messages, home "Reading" label fallback.
   Dates use `toLocaleDateString()` (device locale), not the app language.
5. Notification permission is requested on first launch before onboarding (`app/index.tsx`), not at a contextual moment.
6. Merge-import skips sessions whose book isn't in the backup file (e.g. a sessions-only export).
7. (Fixed in 8.4: goal-form errors each have their own message, a past target date is rejected, and the form no
   longer shifts the target date a day west of UTC.)

## Journey log

- **2026-10-21: Session 1, bug sweep.** High-level read of the whole app, then fixed:
  streaks broken west of UTC and dropping to 0 every morning; WeeklyStatsView longest-streak
  ignoring gaps, UTC time-of-day buckets, and off-by-one week labels; daily goal growing past
  its target forever (+1/week) and growing even when target == current (now linear and capped,
  matching the chart, with catch-up for missed weeks, and applied before the home screen loads);
  Books tab filter only searching the first 10 books; deleting from Books tab orphaning sessions;
  progress not dropping when a session's pages were cleared or deleted; reading logger able to log
  against a just-finished book; books added with 0 pages being stuck (page count is now editable);
  backup merge overwriting unrelated books by id; profile save resetting the growth plan on a
  name change; settings not refreshing; home header remounting every render; yearly goal counting
  all-time books; notifications English-only and able to fire at night (quiet hours added);
  many hard-coded English strings; missing TR key; 3 lint errors.
- **2026-10-21: Session 1b, dead code.** Removed unused components (BookDetailModal,
  BookSearchModal, ReadingCalendar, ReadingStats), unrunnable `scripts/`, `api-test.js`, stale
  root docs, unused helpers in `utils/` and the backup service, and their translation keys.
  Personal backup JSONs are untracked and gitignored, and still on disk. Then ran a multi-agent audit to build the roadmap.
- **Phase 1: trust & correctness.** Fair streaks (goal_history plus backfill, also used by weekly
  stats and the growth chart), a notification lifecycle overhaul, the backup import in an exclusive
  transaction (goal history now backed up), all book writes through `db/repos/books.ts`, one-query
  book lists (no N+1, no per-card queries, `refreshTrigger` removed), session indexes, a dev-only
  logger, expo-image covers, forced light mode. Reviewed by a fresh-eyes subagent before commit.
- **Phase 2: foundations.** `types/models.ts`; `utils/format.ts` replaced ~9 local formatters (dates now
  follow the app language); repos for books, sessions and preferences, with no SQL left in screens
  (lint rule); a change bus plus `useFocusRefresh`; `BookStatusModal` owns its animation (5 copies
  removed); the dev data generator moved out of readinglogs; the notification service's dead
  "column not found" fallbacks removed; unused imports cleaned (lint warnings 29 → 19).
- **Phase 3: UX quick wins.** Backfill/edit session dates (SessionDatePicker); Home taps open books;
  the logger's empty state can start a book; "Erase All Data" with export-first; restore a backup during
  onboarding; onboarding goal preview and validation; all remaining hard-coded English localized; 84
  unused keys removed; genres stored as keys; toasts plus undo replace success alerts; duplicate-add warning.
- **Phase 4: native cleanup.** 10 unused packages removed, Expo SDK 54 patch versions aligned (separate
  commits; **needs `pod install` + device QA before release**), Android storage/overlay permissions dropped,
  notification redesign (onboarding opt-in, one switch, "at a set time" mode).
- **Phase 5: real migrations.** `PRAGMA user_version` plus a `MIGRATIONS` list (baseline = v4, transactional).
  Logout deletes rows instead of dropping/re-creating tables (the duplicate schema is gone); the
  notification-table repair code and table-recreation fallbacks were removed; the first "app opened" is
  tracked after migration. The reviewer found a real corruption race: an overlapping `withTransactionAsync`
  during the migration (from weekly goal growth on app resume) could mark the DB v4 with columns missing.
  Fixed with serialized `runInTransaction`, memoized init, and a root layout that waits for init.
  Verified by shimming expo-sqlite onto Node's built-in `node:sqlite` (the shim must mirror expo-sqlite's
  BEGIN-inside-try transaction code and yield between calls, or races go unnoticed):
  fresh, legacy `books`-only, and a DB created by the original app code (commit 2162355) with data, each
  migrated twice, plus a concurrent run (double init + app-state transaction during the migration), which
  fails on the old code and passes now. Data intact, schema complete, version 4.
- **Phase 6: decompose.** NotificationService split into a facade plus scheduler, repos and dev tools (989 → 204
  lines, stateless); EditSessionModal extracted (readinglogs 1347 → 670); onboarding's final step and styles
  extracted, and onboarding now uses `computeGrowthGoalFields` like Profile and Growth (intro 1292 → 689);
  Profile's edit form and styles extracted (908 → 486). Lint: 5 exhaustive-deps warnings remain.
- **Phase 7 (part 1).** Accessibility (a11y labels/roles/hitSlop, WCAG AA contrast for status badges and tertiary
  text, minHeight inputs, non-scaling tab labels), a "finish by" estimate (pace from page-logged sessions x recent
  minutes per day), streak-at-risk reminder text. Remaining Phase 7 features await owner decisions (see ROADMAP).
- **Phase 7 (part 2), owner decisions applied:** no streak freezes; goals edited only in Growth Journey; a reading
  timer on the Home card; dark mode deferred to its own phase.
  Review fixes: the timer is cleared on erase/restore, never credits a different book, stops under 30s are
  discarded, stops over 4h ask first, and sessions are dated to the timer's start day. The finish estimate uses
  per-book recent minutes, averaged over the days actually read. Profile asks before discarding edits.
  Next: dark mode as its own phase (owner's call), then tests (separate track).
- **Phase 8 (structure + Folio redesign), in progress.** 8.0 fonts, tokens, `components/ui/` primitives; 8.1 Today screen and
  root-hosted session sheets, reminder taps open Today; 8.2 the book page as the book's home (log for this book, its
  sessions, one status control, "…" menu for page count and delete, finish sheet). Review fixes in 8.2: leaving "read"
  asks first (it clears the finish date), finished books show full pages, no "not found" flash on delete, a
  failed finish-sheet load can't block later ones, dates outside this year show the year. 8.3 one Library (search, status
  chips, sections, sort), a root-hosted Add book sheet (Open Library + manual), long-press menu, `useBookStatusChange`;
  Today's "Choose a book" is a sheet of want-to-read books (no cross-tab navigation). Dropped on purpose: sort direction,
  publisher search, title/author-only Open Library search, per-card buttons. 8.4 the Progress tab (index, growth, history),
  yearly goal 0 = unset, name in Settings; Profile, WeeklyStatsView (Analytics) and ~92 keys removed. Review fixes: the
  goal form showed (and re-saved) the UTC date, a day late west of UTC; an expired plan said "Growing"; "most read"
  grouped by title; "days met" counted today before it was met; the name rule now matches onboarding (2–50).
  8.5 three tabs; Settings is a root screen behind a gear on Today and Progress (no redirect stub: `(tabs)/settings`
  and `/settings` are the same URL), restyled with hairline rows; About shows the native version (expo-application).
  8.6 onboarding rebuilt in Folio: name → daily goal → grow it? → reminder → optional first book; genres and the yearly
  step dropped (yearly goal starts unset). Phase 8 is complete.
- **Phase 9.0: simulator QA round 1.** `pod install` done (iOS 26.5 simulator). Walked every flow; review at
  https://claude.ai/artifact/Xon4uLCrwSXwQ5qQG7bJgt. Blocker: `unstable_settings.initialRouteName` in the tab layouts made
  `/` resolve inside the tabs, so boot never ran (removed; see Gotchas). Fixed: Turkish uppercase (`toAppUpperCase`,
  `textTransform` dropped from TYPE); the week strip marks days before tracking began (`getTrackingStartDate`, state
  `"before"`) and Progress stats skip them; Growth rebuilt (planned dashed bars from `projectDailyGoal`, older/newer paging
  measured from the window end, full-week-only summary, axis labels anchored on this week); reminder controls sit under
  their own mode. Date logic checked under LA, Istanbul, Auckland and UTC; paging over 195 range/history combinations.
  The reviewer found unreachable past weeks, a partial-week trend, projection a day late, a stranding redirect.
