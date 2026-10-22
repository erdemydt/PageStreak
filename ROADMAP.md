# PageStreak Roadmap

Synthesized 2026-10-21 from three read-only audits (architecture, product/UX, platform),
with key claims spot-checked against the code. Tests are deliberately out of scope for now.
Check items off as they ship and log them in CLAUDE.md's Journey log.

**Release facts that shape the order:** iOS ships via Xcode Cloud from the committed `ios/`
folder (no prebuild, so never run `expo prebuild --clean`), and there is no OTA updates channel.
Every change reaches users only through an App Store release. **When to release is the owner's
decision**; phases end in a commit, not a ship. The version is hard-coded in
`ios/PageStreak/Info.plist` (`1.0.0` / `1`); bump it there for every release.

## ▶ Start here (handoff, updated 2026-10-22)
Phases 1–7 are done and committed (see CLAUDE.md "Journey log"). **Nothing has been released**; the owner
decides when to ship and tests on device first.

**Owner to-do before the next App Store release:**
1. ~~`pod install`~~: done and committed 2026-10-22 ("Pods for Phase 4").
2. Device QA: first launch of an *existing* install (runs the v4 migration), reminders in both modes, onboarding
   (including restoring a backup), export/import, the Home reading timer.
3. Bump the version in `ios/PageStreak/Info.plist` (app.json `version` is ignored).
4. Still open: an Android notification icon asset; choose Xcode Cloud vs EAS.

**Next work, in order:**
1. **Phase 9: Folio QA** (below): 9.0 done; next 9.1 quick bugs, 9.2 serif accents, 9.3 backup sheet, 9.4 polish.
   Phase 8 history follows.
   **Phase 8: Structure + Folio redesign** (below). The owner chose design direction **A · Folio** from the
   prototypes (https://claude.ai/artifact/23gdMca8CB6BvLTXN5yaaZ, Main + FolioBook artboards) and approved a new
   navigation structure. **8.0–8.6 are done** (code only: needs simulator/device QA of every flow, and the export/
   import modals are still in their older style).
2. **Dark mode** (its own phase, after Phase 8). 8.0 names tokens by role, so dark mode becomes a second palette:
   propose it for owner approval, then un-force light mode (app.json, Info.plist, Android `styles.xml`).
3. **Tests** (separate track, when the owner says): Jest for `utils/` (dates, streaks, goal math), the repos,
   and `scripts/db-migration-check/` as a CI step.
4. Optional: consider `expo-updates`.

## Unreleased user-visible changes (for release notes)
Kept for the owner's release notes; clear it when a release ships.
- Streaks: each day counts against the goal that applied that day, so a weekly goal increase no
  longer breaks a streak. The streak no longer shows 0 in the morning before you've read.
- Weekly goal growth is steady (+N minutes per week), stops at the target, and applies on resume too.
- Reminders: never between 22:00 and 09:00; in your app language; no duplicates; no reminder after
  you've already met the goal.
- Books tab filter shows all matching books (not only the first 10). Deleting a book also removes
  its sessions everywhere. Books with an unknown page count can be fixed on the book page.
- Backup merge no longer overwrites existing books; goal history is included in backups.
- Durations read "45 min", "1 h 30 min" everywhere. Dates follow the app language, not the device language.
  An unset date on Profile shows "—".
- Log a session for yesterday or any past date; edit a session's date.
- Tapping books on Home opens them. With no book in progress, the logger offers "Start reading" for
  want-to-read books.
- "Log Out" is now "Erase All Data" and offers "Export first". Onboarding can restore a backup.
- Onboarding goal step: shows "+N min/week", defaults the date to 3 months out, explains invalid input.
- Success pop-ups are now brief toasts; deleting a session can be undone. Search stays open after
  adding a book and warns about duplicates.
- Turkish: remaining English text translated, consistently formal tone. Genres survive language switches.
- Reminders: no permission prompt at first launch; onboarding asks with an explanation. One
  switch in Settings, plus a new "at a set time (if goal not met)" option.
- "Finish by" estimate on the book page; reminders mention a streak at risk.
- Accessibility: screen-reader labels on icon buttons, larger tap targets, higher-contrast status badges
  and secondary text, inputs that grow with large text.
- Reading timer on the Home card: start, stop (opens the logger pre-filled), or log/discard later.
- Daily and target goals are edited in one place, Growth Journey.
- Faster library lists; covers are cached on disk. The app stays in light mode until dark mode exists.
- New look (Folio): serif headings and numbers, paper colors, a calmer tab bar and headers.
- New Today screen: today's minutes and streak at a glance, this week's days, the book you read last (switch between
  books in progress), and today's sessions (tap to fix one). Tapping a reminder opens Today.
- Logging and editing a session use a new bottom sheet; the logger preselects the book you read last.
- Book page: log reading for that book, see and fix its sessions, change status from one control, edit the page
  count or delete the book from the "…" menu. Finishing a book shows where it lands in your yearly goal and offers
  the next book on your list.
- One Library screen: search, filter by status, sort, and sections for Reading / Want to read / Read. Tap "+" to add a
  book (search Open Library or add it by hand; duplicates are flagged). Long-press a book to change its status or
  delete it. The Books tab is now "Library".
- New Progress tab: your streak (and longest), this week at a glance, your daily-goal plan, books finished this year
  (set or change the yearly goal right there), and the full reading history, where you can add a session on any past
  day. Growth Journey lives here now. The Profile tab is gone: change your name in Settings. The Analytics view and
  genres are gone. With nothing in progress, Today lets you pick the next book from your list.
- Three tabs: Today, Library, Progress. Settings opens from the gear on Today and Progress, with a calmer layout; the
  reminder options sit right under its switch, and About shows the real app version.
- New onboarding: your name, how long you read today (quick presets), whether to grow that goal toward a target (with
  a live preview of the weekly step), a reminder, and optionally the book you're reading now. No genre or yearly-goal
  questions; set a yearly goal any time in Progress.

---

## Phase 0: Housekeeping (no release)
- [x] ~~Scrub backup JSONs from git history~~: owner decided it doesn't matter (they remain in `5ed70eb`).
- [x] Replace the personal Gmail in the Open Library User-Agent (now the project URL; change it if you prefer another contact)

## Phase 1: Trust & correctness (Release A, JS-only)
Things users can feel are wrong today.
- [x] **Fair streaks:** judge each past day against the goal in effect *that* day (derive it from
  `initial_rate + weekly_increase × weeks`, or add a `goal_history` table). Today a weekly goal
  step-up can zero a long streak. (`utils/readingProgress.ts#calculateStreaks`)
- [x] **Notification lifecycle:**
  - Schedule only on `'background'` (not `'inactive'`) and serialize the handler.
  - Use a fixed identifier `daily-reminder` instead of cancel-all.
  - Don't call `requestPermissions()` from schedule paths.
  - Create the Android channel once at startup.
- [x] **Backup import:** use `withExclusiveTransactionAsync` instead of raw BEGIN/COMMIT on the shared connection.
  Drop the import-only PRAGMAs.
- [x] **Remaining writes through helpers:**
  - Logger "finish book" should go through `updateBookStatus`, and always sync progress.
  - One `addBook()` shared by search and manual add.
- [x] **Performance:**
  - Add indexes `reading_sessions(book_id)` and `(date)`.
  - Replace the per-book `getBookReadingTime` N+1 with one JOIN.
  - BookCard should read progress from props / `current_page` instead of querying per card.
- [x] Add a `utils/logger.ts` gated on `__DEV__`. Stop logging user data in release builds.
- [x] Switch cover images to `expo-image` with disk cache (already linked, no native change).
- [x] Set `userInterfaceStyle: "light"` in app.json and Info.plist until real dark mode exists (avoids a dark status bar over the light UI).

## Phase 2: Foundations refactor (no behavior change; can ship with any release)
- [x] `types/models.ts`: one `UserPreferences`, `EnhancedBook`, `ReadingSession`, etc. Typed `queryAll<T>`.
- [x] `utils/format.ts`: one duration and date formatter, aware of the app language (replaces about 9 copies).
- [x] Repositories (`db/repos/{preferences,books,sessions}.ts`), with no SQL left in `app/` or `components/`.
  Enforce it with a `no-restricted-imports` lint rule. Remove dead "column not found" fallbacks and the legacy `books` table fallback.
- [x] Hooks (`useUserPreferences`, `useDailyGoal`, `useBooks`) plus a tiny data-change event bus. Delete `refreshTrigger`.
- [x] `BookStatusModal` owns its animation (removes 5 copies of the Animated boilerplate).
- *Not doing:* Redux/Zustand/React Query, an ORM, FK constraints, normalizing stored dates.

## Phase 3: UX quick wins (Release A or A2, JS-only)
- [x] **Backfill:** a date chip (Today / Yesterday / pick a date) in the logger, and an editable date in session edit.
- [x] **Home dead ends:**
  - Book cards and the hero should open the book detail.
  - The hero shouldn't show a non-reading book under "Reading".
  - The empty logger should offer "Start reading" for a library book.
- [x] **"Log Out" → "Erase all data"**, with "Export first" in the confirm dialog. Add "Restore from backup" in onboarding.
- [x] **Onboarding goals:**
  - Show validation errors instead of silently disabling the button.
  - Show "+N min/week" instead of a compounding %.
  - Default the target date to about 3 months out.
- [x] **i18n leftovers:**
  - Books stack headers, search placeholder, "OK" buttons, backup progress text, the raw Open Library error,
    the boot "Loading...", not-found screen, the raw language code ("eng"), "1 hours".
  - Dates in the app language (onboarding is hard-coded to `en-US`).
- [x] **Genres:** store stable keys, not translated labels (breaks after a language switch). Migrate existing values.
- [x] Replace ~12 blocking success alerts with a toast/haptic (export and import currently double-alert). Add undo for session delete.
- [x] Delete the 57 verified-unused i18n keys (list in the UX audit; put `booksPage.search.failed` to use instead).
- [x] Polish: Turkish sen/siz consistency (now formal throughout), frozen "Weekly goal" on Profile, duplicate-add check in search.
- [x] Single place to edit goals: **Growth Journey only** (Profile shows them read-only; edit mode links there).

## Phase 4: Native cleanup (Release B, needs rebuild + `pod install` + device QA)
- [x] Uninstall unused packages: `notifee`, `@notifee/react-native`, `@expo/ngrok`, `react-native-permissions`,
  `react-native-localize`, `i18next-resources-to-backend`, `expo-symbols`, `react-native-webview`, `expo-blur`,
  `expo-web-browser` (also remove it from the app.json plugins).
- [x] `npx expo install --fix` (expo 54.0.7 → 54.0.x, RN 0.81.5, router, notifications, sqlite patch drift).
- [x] Android: drop the READ/WRITE_EXTERNAL_STORAGE and SYSTEM_ALERT_WINDOW permissions.
- [ ] **Owner:** Android notification icon/color needs a monochrome icon asset (bare project:
  add `notification_icon` drawables plus manifest meta-data, or regenerate via the expo-notifications plugin).
- [x] **Notification permission & reminders redesign:**
  - Ask in onboarding with a pre-prompt (not at first launch).
  - Merge the two toggles into one.
  - Add an "at HH:MM if goal not met" option.
- [ ] **Owner:** decide on a single build path (Xcode Cloud vs EAS) and document it.
- [ ] **Before releasing Phase 4:** run `cd ios && pod install` (CocoaPods wasn't available to Claude),
  commit the updated Podfile.lock, then do full device QA (notifications in both modes, import/export, onboarding).

## Phase 5: Real migrations (ship alone; highest data risk)
- [x] `PRAGMA user_version` with an ordered migrations list in one transaction. Seed from `database_version` (3).
  Migration 4 is the current idempotent create/alter set.
- [x] `logoutUser` deletes rows instead of dropping and re-creating tables (removes the duplicated schema).
- [x] Remove the notification-table "repair" band-aids and the legacy `books` migration (keep it as a one-time step in migration 4).
- [x] Before shipping, test against DB copies from old builds.

## Phase 6: Decompose (no behavior change)
- [x] Split NotificationService: prefs repo, a stateless scheduler, an app-usage repo. Move dev/test methods out.
- [x] Extract `EditSessionModal` (readinglogs, 1.3k lines), the intro steps (1.2k), and the profile goal form.
- [ ] Optional (deferred, visible behavior change): move reading-growth into a Stack under profile, for a native back gesture.

## Phase 7: Product & reach
- [x] ~~Streak freeze / grace day~~: owner decided no freezes (streaks stay strict).
- [x] Built-in reading timer on the hero (survives backgrounding and app kill, prefills the logger; a cancelled log keeps the stopped timer).
- [x] "Finish by" estimate from pages-per-minute (no schema change).
- [x] "Streak at risk" reminder text ("12 more minutes keeps your 9-day streak"); the time is user-set via the "at a set time" mode.
- [x] **Accessibility pass** (labels/roles/hitSlop on icon buttons, contrast tokens, minHeight inputs; a full screen-reader walk-through on device is still worth doing):
  - Labels and roles on 105 touchables.
  - hitSlop for small icons.
  - Contrast (white on want-to-read amber is 2.97:1; tertiary text is 2.58:1).
  - Fixed heights that clip with large text.
- [ ] Real dark mode (L): owner wants it as its own phase after the Phase 7 features.
- [ ] Consider `expo-updates` so JS-only fixes skip App Store review.
- [ ] Tests (separate track, when we're ready).

## Phase 8: Structure + Folio redesign
Decided 2026-10-22 from two independent IA proposals (Claude + a fresh Plan agent) plus owner decisions. **No schema
changes**: UI and routing only. Every old route keeps a `<Redirect>` stub for 2+ releases.

**Target structure: 3 tabs, Today · Library · Progress.** Settings is a root route behind a gear icon. Push what you browse
(book, growth, history, settings); use a sheet for quick tasks (log, edit session, add book, status, goal edits, backup).
- **Today**: date + "Good evening, {name}", today's minutes/goal + streak (shown once), week strip (tap a day → History),
  currently reading (the book with the most recent session, plus a switcher when 2+ are in progress), Log reading / Timer,
  today's sessions (tap → edit), a yearly line. Cut: DailyProgressCard (merged), Reading-journey counts, Recent books, "See all" links.
- **Log sheet**: one `LogSessionProvider` at the root (`openLogger({bookId?, date?, minutes?})`), used by Today, Book detail and History.
- **Library**: one screen (my-books becomes the index): search, status segments, sort menu. `+` opens the **Add book sheet**
  (Open Library search, manual fallback, "Start reading" toast). Long-press a card → status/delete menu.
- **Book detail** (shared route, pushes inside the current tab): one status control ("Mark finished" while reading), progress +
  finish estimate, log/timer for this book, **this book's sessions**, "About this book" collapsed, "…" menu (page count, delete).
  Cut: the Logs/Library cross-tab buttons and the read-only notes. A **finish sheet** on marking a book read ("Book N of goal", next up).
- **Progress**: streak + week strip, trimmed week stats (total, days met, avg/day, top book), Growth card → `growth`
  (moved from the hidden tab), Year card (yearly goal edited here; `0` = unset → "Set a yearly goal"), `history`
  (the readinglogs daily view + "add session" per day). Time-of-day and "insights" analytics are cut.
- **Settings**: name row, language, notifications, backup, About (only useful rows), erase. The Profile tab is removed
  (genres UI cut; the column and backup field stay).
- **Entry points**: cold start, end of onboarding and **reminder taps** (new response listener) → Today. Empty states open the Add sheet.
- **Onboarding**: name (+ restore) → daily goal → grow it? → reminder → optional first book. Genres and yearly-goal steps cut.

- [x] **8.0 Folio foundation**: Newsreader + Inter fonts; semantic, dark-ready tokens (legacy keys mapped); `TYPE` scale;
  `components/ui/` primitives (Screen, Eyebrow, Hairline, Button, Sheet, BookCover, ProgressRule, StatRow); Folio tab bar; haptics.
- [x] **8.1 Logging + Today**: LogSessionProvider, logger as a Folio sheet, Today rebuilt, most-recent-book query,
  notification response listener (after DB init).
- [x] **8.2 Book detail**: per-book sessions, one status control, "…" menu (page count, delete), finish sheet; the
  Logs/Library `withAnchor` jumps are gone. Kept per-stack re-export routes instead of a shared route group (the
  group can't be verified without a device); 8.4 adds `(progress)/book/[id]`.
- [x] **8.3 Library merge**: one Library screen (search, status chips, sections, sort sheet), Add book sheet (Open Library
  + manual, root-hosted so Today opens it in place), long-press menu (status, delete), `my-books`/`search` redirect stubs
  (remove after 2+ releases), shared `useBookStatusChange`. BookCard and ~65 i18n keys removed.
- [x] **8.4 Progress tab**: `(progress)` stack with index (streak, week, week stats, daily-goal card, year card with a
  yearly-goal sheet, 0 = unset) / growth (restyled, GoalSheet) / history (week view, "+" per day). WeeklyStatsView and
  Profile deleted; `profile` / `reading-growth` redirect stubs; name edited in Settings. `(home)/readinglogs` re-exports history.
- [x] **8.5 Settings to gear**: root `app/settings.tsx` pushed from a gear on Today and Progress; 3 tabs. No redirect
  stub for the old tab: groups don't add to the URL, so `(tabs)/settings` and `/settings` would be the same path (and
  nothing links to the old tab from outside the app). Restyled in Folio (hairline rows, `components/settings/`);
  LanguageSelector → an OptionSheet; About = real version (expo-application, from Info.plist; it was already linked via
  expo-notifications, now a direct dependency) + Open Library credit. Erase now dismisses the whole stack before onboarding.
  Left as they were: the export/import modals (page sheets, legacy styling mapped onto Folio tokens).
- [x] **8.6 Onboarding**: name (+ restore) → daily goal (presets, default 20) → grow it? (suggested target, date 3 months
  out, min 1 week / max 5 years, live "+N min a week" preview; "keep" = no growth) → reminder opt-in → profile saved →
  optional first book via the root Add sheet (`closeOnAdd`). `yearly_book_goal = 0`, genres `''` for new users. Intro is
  now a plain fade screen (a native modal would block the root-hosted sheets). `utils/genres.ts`, TargetGoalStep,
  introStyles and the old intro keys removed.

## Phase 9: Folio QA (simulator round 1)
From the simulator review of every flow (https://claude.ai/artifact/Xon4uLCrwSXwQ5qQG7bJgt): 1 blocker, 6 High, 9 Medium,
21 Polish. Owner decisions (2026-10-22): status names stay context-specific (the chip labels are not used everywhere);
backups always include everything (no per-table export switches).

- [x] **9.0 Blocker + first fixes**: launch skipped boot (`unstable_settings.initialRouteName` in tab layouts); Turkish
  uppercase (`toAppUpperCase`); week strip "before you started" days; Growth rebuilt (planned bars, paging, full-week
  summary, axis labels); reminder options under their own mode. Time-zone checked (LA, Istanbul, Auckland, UTC), reviewed.
- [ ] **9.1 Quick bug batch**: restore text in i18n with `formatDate`; stale search submit; blank covers
  (`?default=false`); status toast with Undo; log/edit helper text ("Page 20 of 608"); calmer reminder copy; Progress
  "Per day" and "Days met" counting the same days.
- [ ] **9.2 Serif accents**: Newsreader clips Turkish capitals (İ, Ş, Ç) on iOS; bundle it with a raised ascender, then a
  screenshot pass over every screen.
- [ ] **9.3 Backup and restore on `Sheet`**: one "Create backup" (everything), picker first, merge/replace only when data
  exists, toasts. Test merge/replace against real backup JSONs, including an old-format one.
- [ ] **9.4 Polish**: header/status-bar band, chips, gear styles, sheet close buttons, copy.
