## 1. Cross-Frame Messaging Setup

- [ ] 1.1 Add `RESOLVE_FILE_NAMES` and `FILE_NAMES_RESULT` message types to `src/shared/types.ts`
- [ ] 1.2 Add sidebar DOM scraping handler in top-frame content script (`src/content/content.tsx`) — query `li[data-res-id]` elements, extract `aria-label` and `data-res-id`, return as mapping object
- [ ] 1.3 Add message forwarding for `RESOLVE_FILE_NAMES` / `FILE_NAMES_RESULT` in `src/background/background.ts` to route between top frame and editor iframe

## 2. Inject.js LIST_FILES Update

- [ ] 2.1 Update `LIST_FILES` handler in `src/content/inject.js` to send `RESOLVE_FILE_NAMES` request before building file list
- [ ] 2.2 Implement correlation logic: match `data-res-id` number (from sidebar) to Monaco model URI number (with +1 offset), with fallback to index-based matching
- [ ] 2.3 Return resolved file names in the `files` array instead of numeric URI paths
- [ ] 2.4 Add fallback: if sidebar mapping is empty or times out, return numeric names (current behavior)

## 3. Inject.js READ_FILE_BY_NAME Update

- [ ] 3.1 Update `READ_FILE_BY_NAME` handler to first check if `filename` is a real name (non-numeric), and if so, resolve it to a model URI via the sidebar mapping
- [ ] 3.2 Preserve backward compatibility: if `filename` is numeric, use current direct URI matching

## 4. Cleanup & Diagnostics

- [ ] 4.1 Remove or reduce excessive diagnostic logging in `LIST_FILES` handler (treeitem enumeration, model key dumps) that was added during investigation
- [ ] 4.2 Add concise diagnostic log for resolved file name mapping (e.g., "Resolved 9 files from sidebar")
