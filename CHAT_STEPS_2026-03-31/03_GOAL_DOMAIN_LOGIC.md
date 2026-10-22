# Step 03 - Pure Goal Domain Logic

## Objective

Create pure, testable goal-increase computation helpers before wiring database and UI.

## Why This Step Is Isolated

Separating deterministic math and decision logic from IO reduces risk and makes behavior easier to test.

## In-Scope Files

- utils/goalIncrease.ts (new)
- scripts/test-goal-increase-logic.ts (new)
- utils/goalSettings.ts (only if a shared helper needs small update)

## Out-Of-Scope

- app/index.tsx startup integration
- settings/home/onboarding UI

## Implementation Tasks

1. Create a pure module utils/goalIncrease.ts with:
   - computeWeeksRemaining(targetDateISO, now)
   - computeFixedIncrement(current, target, weeksRemaining)
   - shouldAttemptAutoIncrease(autoEnabled, current, target, lastUpdatedISO, now)
   - evaluateWeeklyConsistency(goalMetDays)
2. Keep all functions side-effect free.
3. Define strict return types for decision results.
4. Add scripts/test-goal-increase-logic.ts with scenario cases:
   - auto disabled
   - under 5 days met
   - exactly 5 days met
   - already at target
   - less than one week elapsed

## Acceptance Criteria

- Goal math and decision flow are testable without DB.
- Edge cases are covered by script tests.

## Verification

1. npm run lint
2. Run script test if TS runner is available.
3. Manually inspect case outputs match expected decisions.

## Handoff Note For Next Step

Next step should only integrate this logic with DB and startup flow (Step 04).
