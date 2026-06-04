## ADDED Requirements

### Requirement: Cleanup initialized synchronously

The `_diffOverlayCleanup` function SHALL be set synchronously before `requestAnimationFrame` is called, so that cancel works even before the rAF fires.

#### Scenario: Cancel before rAF fires
- **WHEN** `EDIT_FILE_REVIEW` starts creating a diff overlay
- **AND** `EDIT_FILE_REVIEW_CANCEL` arrives before `requestAnimationFrame` callback executes
- **THEN** `_diffOverlayCleanup` SHALL be defined (not null)
- **THEN** calling `_diffOverlayCleanup()` SHALL remove the overlay DOM and post DIFF_RESULT(Cancelled)

### Requirement: Dispose old models before overwrite

When `_showDiffOverlay` is called while a previous overlay is still active, the previous overlay's Monaco diff editor and models SHALL be disposed before new ones are created.

#### Scenario: Overwrite existing overlay
- **WHEN** `_showDiffOverlay` is called a second time while the first overlay is still showing
- **THEN** the previous `_diffOverlayCleanup` SHALL be called before the new overlay is created
- **THEN** the old Monaco diff editor and models SHALL be disposed

### Requirement: Duplicate overlay guard

When `_showDiffOverlay` is called, it SHALL check for an existing overlay element (`#vibescript-diff-overlay`) and clean it up before creating a new one.

#### Scenario: Guard against stacking
- **WHEN** an overlay element already exists in the DOM
- **THEN** it SHALL be removed before the new overlay is created
- **THEN** its associated Monaco resources SHALL be disposed

### Requirement: Idempotent cleanup

The `cleanup()` function SHALL be safe to call multiple times. Subsequent calls after the first SHALL be no-ops.

#### Scenario: Double cleanup
- **WHEN** `cleanup()` is called more than once
- **THEN** Monaco `dispose()` calls SHALL only execute on the first invocation
- **THEN** `DIFF_RESULT` SHALL only be posted on the first invocation
