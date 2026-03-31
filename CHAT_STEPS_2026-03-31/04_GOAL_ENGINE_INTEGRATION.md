# Step 04 - Goal Engine Integration In Startup

## Objective

Integrate earned fixed-increment auto-increase into startup flow and retire percentage-based mutation path.

## Why This Step Is Isolated

This is the highest-risk logic change and should be done before UI surfaces are added.

## In-Scope Files

- hooks/useGoalIncrease.ts (new)
- app/index.tsx
- db/db.tsx (only if tiny query helper additions are needed)

## Out-Of-Scope

- settings toggle UI
- home banner UI
- onboarding simplification

## Implementation Tasks

1. Create hooks/useGoalIncrease.ts with function to:
   - load user_preferences
   - enforce auto_increase_enabled == 1
   - check one-week cadence using current_reading_rate_last_updated
   - aggregate last 7 days and count goal-met days
   - require at least 5 goal-met days
   - compute fixed increment and cap to target
   - update current_reading_rate_minutes_per_day and timestamp
2. In app/index.tsx replace old percentage mutation path with new goal engine call.
3. Return or persist structured result for UI consumption in later steps:
   - increased, oldGoal, newGoal, reason
4. Ensure no silent failures; log reasoned outcomes.

## Acceptance Criteria

- Old percentage-based weekly increase path is no longer used.
- Startup applies earned increase only when criteria pass.

## Verification

1. npm run lint
2. Seed reading_sessions test data and verify:
   - fewer than 5 qualifying days -> no increase
   - 5 or more qualifying days -> increase
3. Verify target cap works.

## Handoff Note For Next Step

After core integration works, expose user control in settings (Step 05).
