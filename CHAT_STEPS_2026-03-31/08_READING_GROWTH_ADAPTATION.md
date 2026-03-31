# Step 08 - Reading Growth Screen Adaptation

## Objective

Keep reading-growth route but align its logic and copy with earned fixed-increment behavior.

## Why This Step Is Isolated

Route is retained by decision; adaptation should occur after new logic and onboarding are in place.

## In-Scope Files

- app/(tabs)/reading-growth.tsx
- app/(tabs)/profile.tsx (only if labels/entry text need minor update)
- i18n/index.ts (or locale JSON files)

## Out-Of-Scope

- route deletion
- tab layout structural changes

## Implementation Tasks

1. Remove percentage-centric language from growth screen.
2. Display fixed increment semantics and weekly consistency criterion.
3. If auto_increase_enabled is OFF, show clear disabled-state explanation.
4. Ensure charts/metrics still render without assuming percentage field usage.
5. Keep navigation path from profile intact.

## Acceptance Criteria

- reading-growth no longer implies compound percentage progression.
- Screen remains functional with auto increase ON or OFF.

## Verification

1. npm run lint
2. Navigate profile -> reading-growth and validate no runtime errors.
3. Test ON/OFF states and confirm messaging changes.

## Handoff Note For Next Step

After behavior-level work, perform i18n structure split (Step 09).
