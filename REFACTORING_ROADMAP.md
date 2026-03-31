# PageStreak Comprehensive Refactoring Roadmap

> **Total codebase:** ~23,300 lines across 51 files · 20 files over 500 lines · 5 files over 1,000 lines

---

## Part 1: Folder Structure & Code Refactoring

### New Folder Structure

```
PageStreak/
├── app/                                  # Expo Router (screens only — thin wrappers)
│   ├── _layout.tsx
│   ├── index.tsx                         # Splash — delegates to useAppInit hook
│   ├── intro.tsx                         # Orchestrator only (~250 lines)
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── settings.tsx
│       ├── profile.tsx                   # Slim — delegates to hooks
│       ├── reading-growth.tsx            # May be removed (see Part 2)
│       ├── (home)/
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   └── readinglogs.tsx           # Slim — delegates to hooks
│       └── (books)/
│           ├── _layout.tsx
│           ├── index.tsx
│           ├── [id].tsx
│           ├── my-books.tsx
│           └── search.tsx
│
├── components/
│   ├── ui/                               # Generic reusable primitives
│   │   ├── ModalShell.tsx                # NEW — shared modal animation wrapper
│   │   ├── Card.tsx
│   │   └── SettingsRow.tsx
│   ├── books/                            # Book-related components
│   │   ├── BookCard.tsx
│   │   ├── BookDetailModal.tsx
│   │   ├── BookSearchModal.tsx
│   │   └── BookStatusModal.tsx
│   ├── reading/                          # Reading tracking components
│   │   ├── ReadingTimeLogger.tsx
│   │   ├── DailyProgressCard.tsx
│   │   ├── WeeklyStatsView.tsx
│   │   └── EditSessionModal.tsx          # NEW — extracted from readinglogs.tsx
│   ├── settings/                         # Settings-related components
│   │   ├── NotificationSettings.tsx
│   │   ├── DataExportModal.tsx
│   │   ├── DataImportModal.tsx
│   │   └── LanguageSelector.tsx
│   └── onboarding/                       # Intro wizard steps
│       ├── StepUsername.tsx              # NEW — extracted from intro.tsx
│       ├── StepYearlyGoal.tsx           # NEW
│       ├── StepDailyGoal.tsx            # NEW
│       └── StepConfirmation.tsx         # NEW
│
├── hooks/                                # NEW — custom React hooks
│   ├── useAppInit.ts                    # App startup, DB init, navigation
│   ├── useGoalIncrease.ts              # Weekly goal increase logic
│   ├── useReadingStats.ts              # Today's reading, streak, progress
│   ├── useWeeklyStats.ts              # Weekly aggregation & chart data
│   ├── useBooks.ts                     # Book CRUD, filtering, sorting
│   ├── useReadingSessions.ts           # Session CRUD, editing, deletion
│   ├── useUserPreferences.ts           # Preferences read/write
│   └── useModalAnimation.ts            # Shared fade/scale animation
│
├── services/
│   ├── notificationService.ts           # Slimmed — extract scheduling
│   ├── notificationScheduling.ts        # NEW — extracted from notificationService
│   ├── dataBackupService.ts
│   └── openLibrary.ts
│
├── db/
│   └── db.tsx                            # Unchanged (already well-scoped)
│
├── utils/
│   ├── readingProgress.ts
│   ├── migration.ts
│   ├── goalSettings.ts
│   ├── dateUtils.ts
│   └── bookStatus.ts
│
├── contexts/
│   └── LanguageContext.tsx
│
├── themes/
│   ├── colors.ts
│   ├── typography.ts
│   └── spacing.ts
│
├── i18n/
│   ├── index.ts                          # Config only (~50 lines)
│   ├── en.json                           # NEW — English translations
│   └── tr.json                           # NEW — Turkish translations
│
└── types/
    └── database.ts                       # Single source of truth for UserPreferences
```

### Refactoring Tasks

#### Phase A — Foundations (zero-risk, unblock everything else)

**A1. Split i18n/index.ts (1798 lines → ~50 lines + 2 JSON files)**
- Extract English translations to `i18n/en.json`
- Extract Turkish translations to `i18n/tr.json`
- Keep only i18next config + resource loading in `i18n/index.ts`
- Verify translations load correctly on both languages

**A2. Create `components/ui/ModalShell.tsx`**
- Extract the repeated modal animation pattern (fadeAnim + scaleAnim + Animated.View wrapper) found in 7+ components
- Props: `visible`, `onClose`, `children`, optional `animationDuration`
- Replace duplicated animation setup in: ReadingTimeLogger, BookDetailModal, BookSearchModal, BookStatusModal, DataExportModal, DataImportModal, EditSessionModal

**A3. Consolidate `UserPreferences` type**
- Currently redefined independently in: `app/index.tsx:14`, `app/(tabs)/(home)/index.tsx:27`, `app/(tabs)/profile.tsx`, `app/(tabs)/reading-growth.tsx`, and others
- Move the canonical definition to `types/database.ts`
- Import from there everywhere

**A4. Reorganize components/ into subdirectories**
- Move existing components into `ui/`, `books/`, `reading/`, `settings/` subdirectories as shown in the folder structure above
- Update all import paths across the codebase
- No logic changes — just file moves

#### Phase B — Extract custom hooks

**B1. `hooks/useAppInit.ts`** — from `app/index.tsx:39-98`
- Database initialization, integrity checks, notification init, user setup check
- Returns `{ isLoading, hasUser }`

**B2. `hooks/useGoalIncrease.ts`** — from `app/index.tsx:100-167`
- Weekly progress logic, goal increase calculation
- Called by useAppInit after DB is ready
- This hook will be rewritten in Part 3

**B3. `hooks/useReadingStats.ts`** — from `app/(tabs)/(home)/index.tsx`
- Today's reading minutes, streak calculation, daily goal progress
- Consolidates calls to `getTodayReadingMinutes()`, `getReadingStreak()`, DB queries
- Returns `{ todayMinutes, streak, dailyGoal, progressPercent }`

**B4. `hooks/useWeeklyStats.ts`** — from `components/WeeklyStatsView.tsx` (data logic portion)
- Weekly aggregation queries, date navigation, statistics calculation
- Separates data fetching from chart rendering
- Returns `{ weekData, navigateWeek, stats }`

**B5. `hooks/useBooks.ts`** — from `app/(tabs)/(books)/index.tsx`
- Book list loading, search filtering, sorting logic
- Returns `{ books, filteredBooks, searchQuery, setSearchQuery, sortBy, setSortBy }`

**B6. `hooks/useReadingSessions.ts`** — from `app/(tabs)/(home)/readinglogs.tsx`
- Session CRUD operations, filtering, weekly stats calculation
- Returns `{ sessions, editSession, deleteSession, weeklyStats }`

**B7. `hooks/useUserPreferences.ts`** — from profile.tsx + other screens
- Preferences read/write, goal editing
- Returns `{ preferences, updatePreferences, loading }`

**B8. `hooks/useModalAnimation.ts`** — shared animation hook
- Encapsulates fadeAnim + scaleAnim + show/hide functions
- Used by ModalShell internally, or directly where needed

#### Phase C — Break down the biggest files

**C1. Split `readinglogs.tsx` (1350 → ~350 lines)**
- Extract `EditSessionModal` to `components/reading/EditSessionModal.tsx` (~300 lines)
- Move data logic to `useReadingSessions` hook (Phase B6)
- Remove ReadingCalendar and ReadingStats imports (see Part 2)
- Screen becomes: hook call + FlatList + modal trigger

**C2. Split `intro.tsx` (1308 → ~250 lines)**
- Extract each wizard step to `components/onboarding/Step*.tsx`
- Step 1: Username → `StepUsername.tsx`
- Step 2: Yearly book goal → `StepYearlyGoal.tsx`
- Step 3: ~~Genres~~ REMOVED (see Part 2)
- Step 4: Daily reading goal → `StepDailyGoal.tsx`
- Step 5: ~~Target date~~ REMOVED (see Part 2) → replaced with `StepConfirmation.tsx`
- Orchestrator in intro.tsx manages step index + shared state + final DB save

**C3. Slim `WeeklyStatsView.tsx` (1159 → ~450 lines)**
- Data fetching moved to `useWeeklyStats` hook (Phase B4)
- Component becomes presentational: receives data via props, renders chart
- Extract styles to bottom of file (already there, just cleaner)

**C4. Slim `profile.tsx` (987 → ~400 lines)**
- Delegate preferences to `useUserPreferences` hook
- Remove growth journey section (see Part 2)
- Remove genre display (see Part 2)

**C5. Slim `ReadingTimeLogger.tsx` (932 → ~500 lines)**
- Use ModalShell instead of manual animation
- Extract book selection list to a small sub-component if needed

**C6. Split `notificationService.ts` (1054 → ~600 lines)**
- Extract scheduling logic to `services/notificationScheduling.ts` (~250 lines)
- Keep permission management + lifecycle in main service

#### Phase D — Remove dead code

- Delete `components/NotificationTester.tsx` (410 lines) — dev-only, not for production
- Delete `utils/devMode.ts` (25 lines) — only used by NotificationTester
- Delete `components/ReadingCalendar.tsx` (340 lines) — not imported by any screen (dead code)
- Delete `components/ReadingStats.tsx` (220 lines) — not imported by any screen (dead code)
- Remove dev mode section from `settings.tsx`

---

## Part 2: UI Elements to Remove

### Priority 1 — Free Deletions (dead code / unused data)

| Element | Files | Lines Saved | Rationale |
|---------|-------|-------------|-----------|
| ReadingCalendar | `components/ReadingCalendar.tsx` | ~340 | Not imported anywhere — completely dead code |
| ReadingStats | `components/ReadingStats.tsx` | ~220 | Not imported anywhere — completely dead code |
| Preferred Genres | `intro.tsx` (Step 3), `profile.tsx` (genre tags), `db.tsx` | ~150 | Data collected but **never used** — no recommendations, no filtering, no analytics |
| Dev Mode + NotificationTester | `utils/devMode.ts`, `components/NotificationTester.tsx`, `settings.tsx` | ~435 | Development tools shipping in production |

### Priority 2 — Low-Risk Cuts

| Element | Files | Lines Saved | Rationale |
|---------|-------|-------------|-----------|
| Weekly Goal display | `profile.tsx`, `goalSettings.ts` | ~30 | Just `daily × 7` — redundant, adds no insight |
| Motivational messages | `DailyProgressCard.tsx:35-49` | ~15 | "Goal Crushed!", "Almost There" etc. — decorative, not functional |
| Reading Streak display | `(home)/index.tsx`, `DailyProgressCard.tsx` | ~30 | Gamification — not core to tracking |
| Intro Step 5 (growth target date) | `intro.tsx` | ~100 | Tied to growth journey — simplify onboarding |

### Priority 3 — Moderate Cuts (larger impact)

| Element | Files | Lines Saved | Rationale |
|---------|-------|-------------|-----------|
| Reading Growth Journey screen | `reading-growth.tsx`, `profile.tsx` (button), tab layout | ~950 | Complex visualization buried behind Profile — rarely discovered, high maintenance cost. Growth logic can exist without this screen. |
| WeeklyStatsView detail sections | `WeeklyStatsView.tsx` (distribution, streak, top book) | ~300 | Keep the bar chart, remove: time distribution breakdown, streak info, "top book" ranking. Core insight is minutes/day — rest is noise. |

### Total Lines Saved: ~2,570

### What to Keep
- **DailyProgressCard** — core daily tracking display (simplify but keep)
- **WeeklyStatsView bar chart** — useful weekly overview (slim down extras)
- **Book search via OpenLibrary** — genuine convenience, saves manual entry
- **Data export/import** — important for user trust & data portability
- **Notifications** — useful engagement tool (keep but simplify settings)
- **i18n / Language selector** — already built, low ongoing cost

---

## Part 3: Reading Goal Increase Logic Redesign

### Current Implementation

**How it works today:**
1. During onboarding (Step 4+5), user sets: current daily goal, target daily goal, target date
2. System computes: `weeklyIncreasePercentage = (ceil((target - current) / weeksUntilTarget) / current) × 100`
3. On **every app startup** (`app/index.tsx:100-167`), if ≥1 week has passed:
   - `newRate = currentRate × (1 + percentage/100)`, capped at target, minimum +1
   - Silently updates `current_reading_rate_minutes_per_day` in DB
4. User discovers the change only if they check Profile or notice their daily goal changed

**Key files:**
- `app/index.tsx:100-167` — increase trigger
- `utils/goalSettings.ts:96-121` — computation formula
- `app/(tabs)/reading-growth.tsx` — visualization (may be removed)
- `app/(tabs)/profile.tsx` — displays current/target goals

### Problems

1. **No communication** — user is never told when or why their goal changed
2. **Unconditional increases** — goal goes up even if user hasn't been reading at all
3. **No opt-out** — users can't disable automatic increases
4. **Compound percentage** — unpredictable, hard for users to understand ("3.33% weekly" means nothing to most people)
5. **Silent mutation** — changing someone's daily commitment without their knowledge feels adversarial

### Optimal Solution

**Core principles:**
- Increases should be **earned**, not automatic
- Increases should be **communicated**, not silent
- Increases should be **predictable**, not percentage-based
- UI should be **minimal** — one banner, one toggle

**New logic:**

1. **Earned increases:** Goal only increases if user met their daily goal on **5 out of 7 days** in the past week
2. **Fixed increment:** Instead of compound percentages, increase by a fixed number of minutes (e.g., `ceil((target - current) / weeksRemaining)`, recalculated each week)
3. **Opt-in toggle:** New DB column `auto_increase_enabled` (BOOLEAN, default TRUE). User can toggle this in Settings or Profile.
4. **Transparent communication:** When an increase is earned, show a **dismissible banner on the home screen**: "You've been consistent! Your daily goal increased from X to Y minutes."

### Database Changes

```sql
-- Add to user_preferences
ALTER TABLE user_preferences ADD COLUMN auto_increase_enabled INTEGER DEFAULT 1;

-- Remove (no longer needed with fixed increments)
-- weekly_reading_rate_increase_minutes_percentage  (can keep for migration, stop using)
```

### Implementation Plan

**Step 1: Rewrite `hooks/useGoalIncrease.ts`**
- Check if `auto_increase_enabled` is TRUE
- Query reading_sessions for past 7 days: count days where `SUM(minutes_read) >= daily_goal`
- If ≥5 days met goal AND ≥1 week since last update:
  - Calculate fixed increment: `ceil((target - current) / weeksRemaining)`
  - Apply: `newGoal = min(current + increment, target)`
  - Update DB + timestamp
  - Return `{ increased: true, oldGoal, newGoal }` so UI can show banner
- If <5 days: return `{ increased: false }` — no change

**Step 2: Add opt-out toggle**
- In Settings or Profile screen, add a single toggle: "Automatically increase daily goal"
- Reads/writes `auto_increase_enabled` column
- When disabled, goal stays fixed at current value

**Step 3: Home screen banner**
- In `app/(tabs)/(home)/index.tsx`, if `useGoalIncrease` returns `increased: true`:
  - Show a dismissible info banner at top: "Nice consistency! Goal updated: {old} → {new} min/day"
  - Banner dismisses on tap or after navigating away
  - No modal, no celebration screen — just a simple inline banner

**Step 4: Simplify onboarding**
- Remove Step 5 (target date + growth projection) from intro.tsx
- Keep Step 4 (daily goal) — this is the starting goal
- Add a simple question after daily goal: "Would you like your goal to gradually increase?" (toggle, default ON)
- If ON, set target to `current × 2` (or a sensible default) and target date to end of year
- If OFF, set `auto_increase_enabled = 0`

**Step 5: Clean up reading-growth.tsx**
- If Part 2 Priority 3 is accepted: remove the entire screen
- If kept: update it to reflect the new fixed-increment model and show earned/not-earned status per week

### UI Summary (Minimal)

| Element | Location | Type |
|---------|----------|------|
| "Goal updated" banner | Home screen (top) | Dismissible inline banner |
| "Auto-increase" toggle | Settings or Profile | Single switch |
| Onboarding toggle | Intro Step 4 | Simple yes/no |

**No new screens. No modals. No charts.** The growth visualization screen can be removed entirely.

---

## Execution Order

The tasks should be executed in this sequence to minimize conflicts:

### Wave 1 — Delete & Remove (reduce scope before restructuring)
1. Delete dead code: ReadingCalendar, ReadingStats, NotificationTester, devMode
2. Remove preferred genres from intro + profile + DB
3. Remove weekly goal display from profile
4. Remove motivational messages from DailyProgressCard
5. Remove reading streak display
6. Remove intro Step 5 (growth target date)
7. Remove reading-growth.tsx screen + tab entry + profile button (if approved)

### Wave 2 — Foundation
8. Split i18n translations to JSON files
9. Consolidate UserPreferences type to types/database.ts
10. Create ModalShell component
11. Create useModalAnimation hook
12. Reorganize components/ into subdirectories

### Wave 3 — Extract hooks
13. useAppInit (from app/index.tsx)
14. useUserPreferences (from profile.tsx)
15. useReadingStats (from home/index.tsx)
16. useBooks (from books/index.tsx)
17. useReadingSessions (from readinglogs.tsx)
18. useWeeklyStats (from WeeklyStatsView.tsx)

### Wave 4 — Break down big files
19. Extract EditSessionModal from readinglogs.tsx
20. Extract intro step components
21. Slim WeeklyStatsView to presentational
22. Slim profile.tsx
23. Slim ReadingTimeLogger with ModalShell
24. Split notificationService.ts

### Wave 5 — Goal increase redesign
25. Add `auto_increase_enabled` DB column + migration
26. Rewrite useGoalIncrease hook (earned increases, fixed increment)
27. Add auto-increase toggle to Settings/Profile
28. Add dismissible banner to home screen
29. Simplify onboarding goal step (add toggle, remove target date)
30. Clean up goalSettings.ts (remove percentage logic)

### Verification
- Run the app and complete onboarding flow end-to-end
- Log reading for 7 days, verify goal does NOT increase if <5 days met
- Log reading for 7 days meeting goal 5+, verify goal DOES increase and banner shows
- Toggle auto-increase OFF, verify goal stays fixed
- Switch languages (EN/TR) and verify translations load from JSON
- Verify all screens render without crashes after component moves
- Check that all modals open/close correctly with ModalShell
