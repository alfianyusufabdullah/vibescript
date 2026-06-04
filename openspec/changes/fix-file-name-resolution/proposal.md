## Why

The `LIST_FILES` tool returns numeric IDs (e.g., "2", "3", "4") instead of actual file names (e.g., "Sync/IncentiveSync.gs", "Helper.gs"). This happens because Google Apps Script stores files in Monaco editor models with numeric URI paths (`/2`, `/3`), not descriptive names. The agent loses meaningful context about the codebase it's working on — it tells the user "File 8 contains Levenshtein implementation" instead of "Comparing.gs contains Levenshtein implementation".

## What Changes

- **Resolve file names from GAS sidebar DOM** instead of Monaco model URIs. The sidebar `<li>` elements contain `aria-label` with real file names and `data-res-id` with resource IDs that can be mapped to Monaco models.
- **Build a `resId ↔ filename` mapping** that stays synchronized when files are added, renamed, or deleted.
- **Update `LIST_FILES` handler** in `inject.js` to return resolved file names with proper extensions.
- **Update `READ_FILE_BY_NAME` handler** to accept real file names and resolve them to the correct Monaco model via the mapping.
- **Ensure backward compatibility**: both numeric IDs and real names should work as file identifiers during the transition.

## Capabilities

### New Capabilities
- `file-name-resolution`: Resolve real GAS file names from sidebar DOM and map them to Monaco editor models, replacing numeric ID-based file identification across all editor operations.

### Modified Capabilities
_None — no existing specs to modify._

## Impact

- **`src/content/inject.js`**: `LIST_FILES` and `READ_FILE_BY_NAME` handlers need to use the new mapping instead of raw `model.uri.path`.
- **`src/content/content.tsx`**: Top-frame content script needs to support sidebar DOM queries and forward mapping data to the editor iframe.
- **`src/background/background.ts`**: May need new message types for cross-frame mapping communication.
- **Agent behavior**: Agent will see real file names, improving code context and user-facing output quality.
