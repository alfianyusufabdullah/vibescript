## Context

VibeScript's `inject.js` runs inside the Monaco editor iframe on Google Apps Script (GAS). It handles `LIST_FILES` and `READ_FILE_BY_NAME` by reading Monaco model URIs, which are numeric IDs (`/2`, `/3`, etc.) rather than real file names. Meanwhile, the GAS sidebar in the top frame contains `<li>` elements with `aria-label` attributes holding real file names and `data-res-id` attributes like `file_1`, `file_2`.

The architecture has two frames:
- **Top frame**: Contains sidebar DOM with file names. Content script runs here.
- **Editor iframe**: Contains Monaco editor. Content script + inject.js run here.

Cross-frame communication goes through: inject.js ↔ content script (iframe) ↔ background.ts ↔ content script (top) ↔ sidebar DOM.

## Goals / Non-Goals

**Goals:**
- `LIST_FILES` returns real file names (e.g., "Sync/IncentiveSync.gs") instead of numeric IDs
- `READ_FILE_BY_NAME` accepts real file names and resolves them to the correct Monaco model
- Mapping stays current when files are added or removed during a session
- Backward compatible: numeric IDs still work as identifiers

**Non-Goals:**
- Handling file rename detection (GAS doesn't expose rename events easily)
- Replacing the Monaco model system — we only augment it with name resolution
- Supporting cross-project file listing

## Decisions

### 1. Sidebar DOM scraping from top frame content script

**Decision**: Query `li[data-res-id]` elements in the top frame to build a `resId → filename` mapping, then send it to inject.js on demand.

**Alternatives considered**:
- *Monaco model metadata*: Monaco models in GAS don't store file names — dead end.
- *Click-based navigation*: Click each sidebar item to activate it, then read the model — too slow and causes visible side effects.
- *Content-based matching*: Compare model content against known file signatures — fragile, won't work for empty/new files.

**Rationale**: The sidebar DOM is the **only** reliable source of truth for file names. It's always present, updated by GAS itself, and queryable via standard selectors.

### 2. On-demand mapping via message passing

**Decision**: When `LIST_FILES` is triggered, inject.js sends a new message `RESOLVE_FILE_NAMES` to the content script in the top frame. The top frame content script scrapes the sidebar DOM and replies with the mapping. Inject.js then correlates Monaco models to file names using `data-res-id` number ↔ model URI number.

**Alternatives considered**:
- *MutationObserver*: Maintain a live map via observer on the sidebar — more complex, uses memory, and the sidebar may not change often enough to justify.
- *Periodic polling*: Poll sidebar every N seconds — wasteful and still not guaranteed fresh.

**Rationale**: On-demand is simplest, always fresh, and the sidebar query is fast (< 5ms for typical project sizes).

### 3. Correlation strategy: `data-res-id` number to Monaco model URI

**Decision**: Extract the numeric part from `data-res-id` (e.g., `file_1` → `1`), add 1 to get the Monaco model URI path (e.g., `/2`). If the offset hypothesis fails, fall back to index-based ordering (sidebar index N → models[N]).

**Rationale**: From observed data, `file_1` maps to model URI `/2`, `file_2` → `/3`, etc. The +1 offset is likely because Monaco model `/1` is a system/internal model. A fallback ensures robustness if the offset changes.

## Risks / Trade-offs

- **Offset assumption may break** → Mitigation: validate by checking if model count matches sidebar count. If mismatch, log warning and fall back to serving names from sidebar only (without model content linkage).
- **Sidebar DOM structure may change with GAS updates** → Mitigation: use `aria-label` which is accessibility-standard and less likely to change than class names.
- **Cross-frame messaging adds latency** → Mitigation: sidebar query is fast (< 5ms), and total round-trip should be < 50ms. Acceptable for a user-triggered operation.
- **inject.js can't verify mapping correctness** → Mitigation: include model count sanity check and diagnostic logging for debugging.
