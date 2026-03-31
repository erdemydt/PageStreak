# Step 09 - i18n Split To JSON Resources

## Objective

Split large translation payload from i18n/index.ts into language JSON files while preserving key parity.

## Why This Step Is Isolated

Large text movement can hide functional regressions; isolation keeps the diff reviewable.

## In-Scope Files

- i18n/index.ts
- i18n/en.json (new)
- i18n/tr.json (new)
- scripts/check-i18n-parity.ts (new, optional but recommended)

## Out-Of-Scope

- business logic changes
- UI redesign

## Implementation Tasks

1. Extract English translation object to i18n/en.json.
2. Extract Turkish translation object to i18n/tr.json.
3. Keep i18n/index.ts as configuration and resource wiring only.
4. Remove orphan keys from deleted features where appropriate.
5. Add parity check script or equivalent validation to detect missing keys.

## Acceptance Criteria

- App loads translations from JSON files.
- Both languages work across onboarding/home/settings/profile/growth.
- No missing-key regressions in active screens.

## Verification

1. npm run lint
2. Switch language EN -> TR -> EN in app settings.
3. Validate key surfaces manually: onboarding, settings, home banner, growth screen.
4. If parity script added, run it and ensure zero critical mismatches.

## Handoff Note For Next Step

After i18n stabilization, proceed to modal abstraction foundation (Step 10).
