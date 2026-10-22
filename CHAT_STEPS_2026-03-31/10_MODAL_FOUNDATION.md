# Step 10 - Modal Foundation (Hook + Shell)

## Objective

Create shared modal animation foundation and migrate a small pilot set first.

## Why This Step Is Isolated

Modal behavior is cross-cutting and easy to break; start with controlled pilot before broad migration.

## In-Scope Files

- hooks/useModalAnimation.ts (new)
- components/ui/ModalShell.tsx (new)
- components/DataExportModal.tsx (pilot)
- components/DataImportModal.tsx (pilot)

## Out-Of-Scope

- Full modal migration across books and reading in this step

## Implementation Tasks

1. Implement useModalAnimation hook with fade + scale open/close helpers.
2. Implement ModalShell wrapper with visible/onClose/children/animationDuration props.
3. Migrate DataExportModal and DataImportModal to ModalShell.
4. Keep visual behavior equivalent.
5. Ensure close interactions and backdrop behavior remain intact.

## Acceptance Criteria

- New modal primitives compile and are reusable.
- Two pilot modals function exactly as before.

## Verification

1. npm run lint
2. Open/close export/import modals repeatedly.
3. Confirm backdrop tap and close button behavior.

## Handoff Note For Next Step

After pilot success, move to hook extraction batch A (Step 11).
