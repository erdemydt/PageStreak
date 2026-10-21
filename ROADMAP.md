# PageStreak Roadmap

Synthesized 2026-10-21 from three read-only audits (architecture, product/UX, platform),
with key claims spot-checked against the code. Tests are deliberately out of scope for now.
Check items off as they ship and log them in CLAUDE.md's Journey log.

**Release facts that shape the order:** iOS ships via Xcode Cloud from the committed `ios/`
folder (no prebuild, so never run `expo prebuild --clean`), and there is no OTA updates channel.
Every change reaches users only through an App Store release. **When to release is the owner's
decision**; phases end in a commit, not a ship. The version is hard-coded in
`ios/PageStreak/Info.plist` (`1.0.0` / `1`); bump it there for every release.

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
- Faster library lists; covers are cached on disk. The app stays in light mode until dark mode exists.

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
- [ ] **Decide (owner):** a single place to edit goals. Profile and Growth Journey both edit current/target
  goals, and only Growth Journey edits the date. Deferred because it's a design choice, not a fix.

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
- [ ] Streak freeze / grace day (builds on fair streaks).
- [ ] Built-in reading timer on the hero (survives backgrounding, prefills the logger).
- [ ] "Finish by" estimate from pages-per-minute (no schema change).
- [ ] "Streak at risk" evening reminder ("12 more minutes keeps your 9-day streak").
- [ ] **Accessibility pass:**
  - Labels and roles on 105 touchables.
  - hitSlop for small icons.
  - Contrast (white on want-to-read amber is 2.97:1; tertiary text is 2.58:1).
  - Fixed heights that clip with large text.
- [ ] Real dark mode (L).
- [ ] Consider `expo-updates` so JS-only fixes skip App Store review.
- [ ] Tests (separate track, when we're ready).
