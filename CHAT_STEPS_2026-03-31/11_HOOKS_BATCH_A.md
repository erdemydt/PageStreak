# Step 11 - Hook Extraction Batch A

## Objective

Extract first set of high-value hooks with moderate complexity.

## Why This Step Is Isolated

Batch A targets medium files with lower coupling than readinglogs/weeklystats heavy paths.

## In-Scope Files

- hooks/useAppInit.ts (new)
- hooks/useUserPreferences.ts (new)
- hooks/useReadingStats.ts (new)
- hooks/useBooks.ts (new)
- app/index.tsx
- app/(tabs)/(home)/index.tsx
- app/(tabs)/profile.tsx
- app/(tabs)/(books)/index.tsx

## Out-Of-Scope

- readinglogs heavy split
- weekly stats extraction

## Implementation Tasks

1. Extract startup init flow from app/index.tsx into useAppInit.
2. Extract preference load/update logic from profile into useUserPreferences.
3. Extract home stats loading into useReadingStats.
4. Extract books listing/filter/sort from books index screen into useBooks.
5. Keep UI behavior stable while reducing screen file complexity.

## Acceptance Criteria

- Hook APIs are typed and reusable.
- Screens become thinner and behavior remains unchanged.

## Verification

1. npm run lint
2. Manual smoke: app launch, books list/filter, profile edit save, home refresh.

## Handoff Note For Next Step

Continue with heavier hook extraction and major file splits in Step 12.
