import { getMonaco, langFromFilename } from './inject-editor-utils.js';
import { state } from './inject-state.js';

const COLOR_APPROVE = '#2da44e';
const COLOR_APPROVE_HOVER = '#218838';
const COLOR_REJECT = '#cf222e';
const COLOR_REJECT_HOVER = '#a71d2a';

const OVERLAY_STYLES =
  '#vibescript-diff-overlay{position:absolute;inset:0;z-index:100;background:#fff;display:flex;flex-direction:column}' +
  '#vibescript-diff-header{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px}' +
  '#vibescript-diff-filename{font-weight:600;color:#1f2328}' +
  '#vibescript-diff-stats{font-size:12px}' +
  '#vibescript-diff-container{flex:1;overflow:hidden}' +
  '#vibescript-diff-footer{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px;border-top:1px solid #d0d7de}' +
  `#vibescript-diff-approve{background:${COLOR_APPROVE};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}` +
  `#vibescript-diff-approve:hover{background:${COLOR_APPROVE_HOVER}}` +
  `#vibescript-diff-reject{background:${COLOR_REJECT};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}` +
  `#vibescript-diff-reject:hover{background:${COLOR_REJECT_HOVER}}`;

function postDiffResult(requestId, approved, output) {
  window.postMessage({
    source: 'vibescript-inject',
    action: 'DIFF_RESULT',
    payload: { requestId, approved, output },
  }, '*');
}

function disposeDiffResources(diffEditor, origModel, modModel) {
  if (diffEditor) {
    try { diffEditor.dispose(); } catch (e) { console.warn('[VibeScript] diffEditor dispose error:', e); }
  }
  if (origModel && !origModel.isDisposed()) {
    try { origModel.dispose(); } catch (e) { }
  }
  if (modModel && !modModel.isDisposed()) {
    try { modModel.dispose(); } catch (e) { }
  }
}

export function showDiffOverlay(editor, original, modified, range, replaceText, requestId, optFilename, onApprove) {
  const monaco = getMonaco();
  const model = editor.getModel();
  if (!model) return;

  if (state.diffOverlayCleanup) {
    state.diffOverlayCleanup();
    state.diffOverlayCleanup = null;
  }

  const existingOverlay = document.getElementById('vibescript-diff-overlay');
  if (existingOverlay) existingOverlay.remove();
  const existingStyles = document.getElementById('vibescript-diff-styles');
  if (existingStyles) existingStyles.remove();

  const fileName = optFilename || (model.uri ? model.uri.path.replace(/^\//, '') : 'untitled');
  const lang = optFilename ? langFromFilename(optFilename) : model.getLanguageId();
  const container = editor.getContainerDomNode();
  container.style.position = 'relative';

  const overlay = document.createElement('div');
  overlay.id = 'vibescript-diff-overlay';

  const header = document.createElement('div');
  header.id = 'vibescript-diff-header';
  const filenameEl = document.createElement('span');
  filenameEl.id = 'vibescript-diff-filename';
  filenameEl.textContent = fileName;
  header.appendChild(filenameEl);
  const statsEl = document.createElement('span');
  statsEl.id = 'vibescript-diff-stats';
  header.appendChild(statsEl);
  overlay.appendChild(header);

  const diffContainer = document.createElement('div');
  diffContainer.id = 'vibescript-diff-container';
  overlay.appendChild(diffContainer);

  const footer = document.createElement('div');
  footer.id = 'vibescript-diff-footer';
  const rejectBtn = document.createElement('button');
  rejectBtn.id = 'vibescript-diff-reject';
  rejectBtn.textContent = 'Reject';
  footer.appendChild(rejectBtn);
  const approveBtn = document.createElement('button');
  approveBtn.id = 'vibescript-diff-approve';
  approveBtn.textContent = 'Approve';
  footer.appendChild(approveBtn);
  overlay.appendChild(footer);

  container.appendChild(overlay);

  const styleEl = document.createElement('style');
  styleEl.id = 'vibescript-diff-styles';
  styleEl.textContent = OVERLAY_STYLES;
  document.head.appendChild(styleEl);

  let diffEditor = null;
  let origModel = null;
  let modModel = null;
  let disposed = false;

  state.diffOverlayCleanup = () => {
    if (disposed) return;
    disposed = true;
    overlay.remove();
    const s = document.getElementById('vibescript-diff-styles');
    if (s) s.remove();
    disposeDiffResources(diffEditor, origModel, modModel);
    state.diffOverlayCleanup = null;
    postDiffResult(requestId, false, 'Cancelled');
  };

  requestAnimationFrame(() => {
    if (disposed) return;

    origModel = monaco.editor.createModel(original, lang);
    modModel = monaco.editor.createModel(modified, lang);

    diffEditor = monaco.editor.createDiffEditor(diffContainer, {
      renderSideBySide: true,
      readOnly: true,
      enableSplitViewResizing: false,
      originalEditable: false,
      contextmenu: false,
      scrollBeyondLastLine: false,
      fontSize: 12,
    });

    diffEditor.setModel({ original: origModel, modified: modModel });

    diffEditor.onDidUpdateDiff(() => {
      const changes = diffEditor.getLineChanges();
      let added = 0;
      let deleted = 0;
      if (changes) {
        for (const c of changes) {
          if (c.originalEndLineNumber > 0) {
            deleted += c.originalEndLineNumber - c.originalStartLineNumber + 1;
          }
          if (c.modifiedEndLineNumber > 0) {
            added += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
          }
        }
        if (changes.length > 0) {
          const first = changes[0];
          const line = first.modifiedStartLineNumber || first.modifiedEndLineNumber || 1;
          diffEditor.getModifiedEditor().revealLineInCenter(line);
        }
      }
      statsEl.textContent = '';
      const addSpan = document.createElement('span');
      addSpan.style.color = '#1a7f37';
      addSpan.textContent = `+${added}`;
      statsEl.appendChild(addSpan);
      statsEl.appendChild(document.createTextNode(' '));
      const delSpan = document.createElement('span');
      delSpan.style.color = COLOR_REJECT;
      delSpan.textContent = `-${deleted}`;
      statsEl.appendChild(delSpan);
    });

    const cleanupDiffEditor = () => {
      if (disposed) return;
      disposed = true;
      overlay.remove();
      const s = document.getElementById('vibescript-diff-styles');
      if (s) s.remove();
      disposeDiffResources(diffEditor, origModel, modModel);
      state.diffOverlayCleanup = null;
    };

    const settleDiffReview = (approved) => {
      cleanupDiffEditor();
      postDiffResult(requestId, approved, approved ? 'Applied' : 'Rejected');
    };

    rejectBtn.onclick = () => settleDiffReview(false);
    approveBtn.onclick = async () => {
      if (onApprove) {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Creating...';
        try {
          const ok = await onApprove();
          settleDiffReview(ok ? true : false);
        } catch (e) {
          console.error('[VibeScript] onApprove error:', e);
          settleDiffReview(false);
        }
      } else {
        try {
          editor.executeEdits('vibescript', [{ range, text: replaceText, forceMoveMarkers: true }]);
          settleDiffReview(true);
        } catch (e) {
          console.error('[VibeScript] executeEdits error:', e);
          settleDiffReview(false);
        }
      }
    };
  });
}
