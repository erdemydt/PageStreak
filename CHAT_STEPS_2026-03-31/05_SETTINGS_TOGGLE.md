# Step 05 - Settings Auto-Increase Toggle

## Objective

Expose auto_increase_enabled in settings and persist toggle state safely.

## Why This Step Is Isolated

After core engine exists, users need explicit control before behavioral rollout is considered complete.

## In-Scope Files

- app/(tabs)/settings.tsx
- i18n/index.ts (or locale JSON files if split already started)

## Out-Of-Scope

- Home banner
- Onboarding changes

## Implementation Tasks

1. Load auto_increase_enabled with user preferences in settings.
2. Add one dedicated settings row/switch:
   - label: Automatically increase daily goal
   - description: Increase only when weekly consistency criteria are met
3. Persist toggle updates to user_preferences.auto_increase_enabled.
4. Handle optimistic UI or rollback on DB update failure.
5. Add/adjust translation keys.

## Acceptance Criteria

- Toggle is visible and editable in settings.
- Value persists across app restart.
- Disabled toggle prevents future auto increases.

## Verification

1. npm run lint
2. Toggle OFF then relaunch app; verify value remains OFF.
3. Toggle ON then relaunch app; verify value remains ON.
4. Confirm no crash when user_preferences row is missing; use sensible fallback.

## Handoff Note For Next Step

After user control is in place, add the home feedback surface (Step 06).
