# Step 01 - Schema Propagation For auto_increase_enabled

## Objective

Finish schema consistency for auto_increase_enabled across all user_preferences table creation paths.

## Why This Step Is Isolated

This is low-risk and unblocks all goal-redesign work. It touches only schema definitions and one existing schema test script.

## In-Scope Files

- utils/migration.ts
- scripts/test-database-init.ts

## Out-Of-Scope

- Goal calculation logic
- UI changes
- Backup import/export logic

## Implementation Tasks

1. Update user_preferences creation SQL in runMigration path in utils/migration.ts.
2. Update user_preferences creation SQL in logout/reset recreation path in utils/migration.ts.
3. Add auto_increase_enabled to expected user columns in scripts/test-database-init.ts.
4. Keep default as INTEGER DEFAULT 1 in all table definitions.
5. Do not remove legacy columns in this step.

## Acceptance Criteria

- All user_preferences CREATE TABLE statements include auto_increase_enabled INTEGER DEFAULT 1.
- scripts/test-database-init.ts expects auto_increase_enabled.
- No behavior regressions outside schema creation.

## Verification

1. npm run lint
2. Confirm string presence in migration and db files with search for auto_increase_enabled.
3. If a TS runner is available, run scripts/test-database-init.ts and ensure it passes.

## Handoff Note For Next Step

After this step, continue to backup compatibility updates only (Step 02).
