# Step 14 - Final Integrated Test Matrix

## Objective

Run a complete verification sweep and produce release-ready confidence summary.

## Why This Step Is Isolated

Cross-feature testing should happen after all implementation steps stabilize.

## In-Scope Files

- scripts/ (new or updated test helpers as needed)
- docs/checklists if needed
- no major feature edits unless blockers are found

## Required Test Categories

### A. Static Checks

1. npm run lint
2. Type/problem check in editor (no errors)

### B. Core Flow Tests

1. Fresh launch -> onboarding -> home route success
2. Settings toggle for auto increase persists after restart
3. Home banner appears only after earned increase and dismisses correctly

### C. Goal Engine Scenarios

1. <5 goal-met days in last 7 -> no increase
2. > =5 goal-met days in last 7 -> increase applied
3. auto_increase_enabled = 0 -> no increase even if consistent
4. current goal at target -> no further increase

### D. Data Integrity

1. Migration paths include auto_increase_enabled
2. Backup export includes auto_increase_enabled
3. Backup import without field defaults to 1 and succeeds

### E. Feature Regression

1. Books list/search/status updates
2. Reading log create/edit/delete
3. Weekly analytics render
4. Notification settings and reminder scheduling
5. EN/TR language switch (if i18n split completed)

## Optional Script Tests To Add If Missing

- scripts/test-auto-increase-schema.ts
- scripts/test-backup-auto-increase.ts
- scripts/test-goal-increase-logic.ts

## Completion Criteria

- Zero lint/type errors.
- All critical scenarios pass.
- Any remaining warnings are documented with rationale.
- Final summary generated for merge/PR notes.
