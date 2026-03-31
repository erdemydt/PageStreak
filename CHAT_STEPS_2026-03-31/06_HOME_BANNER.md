# Step 06 - Home Goal-Updated Banner

## Objective

Add a dismissible home banner when an earned auto-increase occurs.

## Why This Step Is Isolated

UI feedback depends on Step 04 event data and should be added independently to avoid mixing logic and presentation changes.

## In-Scope Files

- app/(tabs)/(home)/index.tsx
- app/index.tsx (only for event handoff if required)
- i18n/index.ts (or locale JSON files)

## Out-Of-Scope

- Onboarding simplification
- reading-growth adaptation

## Implementation Tasks

1. Define a short-lived event payload for goal updates:
   - oldGoal, newGoal, timestamp
2. Persist event at startup when increase occurs (if not already done in Step 04).
3. In home screen, read event on focus and display inline banner.
4. Add dismiss action that clears banner event.
5. Ensure banner is not shown repeatedly after dismissal.
6. Add translation keys for banner title/body/dismiss.

## Acceptance Criteria

- Banner appears only when an actual increase was applied.
- Banner is dismissible and does not reappear after dismissal.

## Verification

1. npm run lint
2. Trigger increase scenario; verify banner shows old -> new values.
3. Dismiss banner; verify it stays hidden on return.

## Handoff Note For Next Step

After banner is working, simplify onboarding to align with the new model (Step 07).
