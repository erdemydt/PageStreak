# Step 12 - Hook Extraction Batch B + Major Splits

## Objective

Handle high-complexity modules: reading sessions, weekly stats, and large component/screen splits.

## Why This Step Is Isolated

This is the heaviest step by code volume and coupling; keep it separate from component moves.

## In-Scope Files

- hooks/useReadingSessions.ts (new)
- hooks/useWeeklyStats.ts (new)
- app/(tabs)/(home)/readinglogs.tsx
- components/reading/EditSessionModal.tsx (new path target)
- components/WeeklyStatsView.tsx
- components/ReadingTimeLogger.tsx
- services/notificationScheduling.ts (new)
- services/notificationService.ts

## Out-Of-Scope

- global component folder reorganization
- i18n split (already done earlier)

## Implementation Tasks

1. Extract session CRUD/filtering from readinglogs into useReadingSessions.
2. Extract edit modal UI from readinglogs into dedicated component.
3. Extract weekly stats data logic from WeeklyStatsView into useWeeklyStats.
4. Slim ReadingTimeLogger using ModalShell pattern where possible.
5. Split notification scheduling logic from notificationService into notificationScheduling service.

## Acceptance Criteria

- readinglogs is significantly slimmer and readable.
- weekly stats component is primarily presentational.
- notificationService keeps lifecycle/permissions while scheduling is externalized.

## Verification

1. npm run lint
2. Manual smoke: add/edit/delete session, weekly analytics navigation, log reading modal, notifications schedule check.

## Handoff Note For Next Step

After heavy splits stabilize, perform component folder reorganization in Step 13.
