# Step 13 - Component Folder Reorganization

## Objective

Move flat components into domain subdirectories and update imports with zero logic changes.

## Why This Step Is Isolated

Path rewrites can produce broad diffs; isolation prevents mixing move-noise with logic edits.

## In-Scope Files

- components/\* (moves into ui/books/reading/settings/onboarding)
- all importing screens/components in app and components directories

## Out-Of-Scope

- logic changes
- schema/goal behavior changes

## Implementation Tasks

1. Create target subfolders under components:
   - ui
   - books
   - reading
   - settings
   - onboarding
2. Move existing files to target domains.
3. Rewrite imports everywhere accordingly.
4. Verify no unresolved imports remain.
5. Keep component exports and behavior unchanged.

## Acceptance Criteria

- All components are in domain folders.
- App builds with no import/path errors.

## Verification

1. npm run lint
2. Run unresolved import search for old paths.
3. Manual smoke navigation across tabs and major modals.

## Handoff Note For Next Step

Finish with final integrated test matrix and release checklist in Step 14.
