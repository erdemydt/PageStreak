# PageStreak Split Step Pack (2026-03-31)

## Purpose

Use these files to continue implementation in fresh chats one step at a time with controlled scope, predictable context size, and explicit verification gates.

## How To Use

1. Open one step file only.
2. Paste that step content into a new chat.
3. Complete the step and verify its tests.
4. Move to the next step file.

## Step Sizing Strategy

- Each step targets 1 feature axis.
- Typical file scope per step: 2 to 6 files.
- Avoid mixed concerns in one chat.
- Every step has test gates and completion criteria.

## Current Baseline

- Working tree status at pack creation: clean.
- Already done before this pack: dev cleanup, dead file removals, streak and motivational UI removal, profile genre and weekly-goal UI removal, initial type consolidation, db version bump to 4, auto_increase_enabled added in db schema and canonical type.
- Remaining work is split below.

## Step Sequence

1. 01_SCHEMA_PROPAGATION.md
2. 02_BACKUP_COMPAT.md
3. 03_GOAL_DOMAIN_LOGIC.md
4. 04_GOAL_ENGINE_INTEGRATION.md
5. 05_SETTINGS_TOGGLE.md
6. 06_HOME_BANNER.md
7. 07_ONBOARDING_SIMPLIFICATION.md
8. 08_READING_GROWTH_ADAPTATION.md
9. 09_I18N_SPLIT.md
10. 10_MODAL_FOUNDATION.md
11. 11_HOOKS_BATCH_A.md
12. 12_HOOKS_BATCH_B_AND_SPLITS.md
13. 13_COMPONENT_REORG.md
14. 14_FINAL_TEST_MATRIX.md

## Prompt Template For Each New Chat

Continue implementation using the instructions in [STEP_FILE_NAME].
Follow the step exactly, keep edits limited to in-scope files, run the defined tests, and report completion against the step's done criteria.
Do not expand to later steps.
