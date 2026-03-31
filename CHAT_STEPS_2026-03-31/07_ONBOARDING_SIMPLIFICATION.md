# Step 07 - Onboarding Simplification And Persistence Alignment

## Objective

Simplify onboarding by removing genres and target-date steps, and capture auto-increase preference.

## Why This Step Is Isolated

This is a high-churn single-file flow with heavy validation logic; isolate it to reduce merge conflicts.

## In-Scope Files

- app/intro.tsx
- i18n/index.ts (or locale JSON files)

## Out-Of-Scope

- reading-growth screen updates
- i18n split to JSON files

## Implementation Tasks

1. Remove preferred genres collection from onboarding state and UI.
2. Remove target-date step and date picker logic from onboarding.
3. Introduce autoIncreaseEnabled toggle in onboarding flow.
4. Keep daily goal input.
5. Persist initial values with new defaults:
   - current daily goal = user input
   - target daily goal = current \* 2 when auto increase is ON
   - target date = end of current year when auto increase is ON
   - auto_increase_enabled = 1 or 0 from toggle
6. Keep validation strict but simpler than previous multi-step flow.

## Acceptance Criteria

- Onboarding has no genres step and no target-date picker.
- New users can choose auto increase on/off.
- user_preferences row stores auto_increase_enabled correctly.

## Verification

1. npm run lint
2. Complete onboarding with auto increase ON; verify DB fields.
3. Complete onboarding with auto increase OFF; verify field is 0.
4. Verify app navigates correctly after onboarding completion.

## Handoff Note For Next Step

Next adapt reading-growth to the fixed increment and earned model (Step 08).
