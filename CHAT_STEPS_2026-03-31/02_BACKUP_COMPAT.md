# Step 02 - Backup Import/Export Compatibility

## Objective

Ensure backup import/export correctly handles auto_increase_enabled while remaining compatible with older backups.

## Why This Step Is Isolated

Backup compatibility should be solved before runtime goal logic changes, otherwise data portability becomes ambiguous.

## In-Scope Files

- services/dataBackupService.ts
- types/database.ts (only if needed; field already exists)

## Out-Of-Scope

- Goal algorithm changes
- UI changes

## Implementation Tasks

1. Update user_preferences import SQL (replace mode) to include auto_increase_enabled.
2. Update user_preferences import SQL (merge mode) to include auto_increase_enabled.
3. In value arrays, use safe fallback for old backups:
   - pref.auto_increase_enabled ?? 1
4. Validate that export path still includes the field (SELECT \* should cover it).
5. Optionally add a warning in backup validation when field is missing but do not fail import.

## Acceptance Criteria

- Import works for backups with and without auto_increase_enabled.
- Imported users without field default to 1.
- Exported backups include auto_increase_enabled once data exists.

## Verification

1. npm run lint
2. Manual test: import a backup missing auto_increase_enabled and verify user_preferences value is 1.
3. Manual test: export backup and verify field appears under user_preferences entries.

## Handoff Note For Next Step

After this step, proceed to pure goal-domain logic extraction (Step 03).
