import { getMonaco, getActiveEditor } from './inject-editor-utils.js';
import { logDiagnostics } from './inject-log.js';

const MAX_Z_INDEX = 2147483647;
const PILL_VERTICAL_OFFSET_PX = 38;
const DEFAULT_LINE_TOP_PX = 100;
const DEFAULT_NODE_WIDTH_PX = 500;
const PILL_BG_COLOR = '#18181b';
const PILL_BG_HOVER_COLOR = '#27272a';
const EDITOR_POLL_LIMIT = 30;
const EDITOR_POLL_INTERVAL_MS = 2000;

let selectionPill = null;
const attachedEditors = new WeakSet();

function setAttributes(el, attrs) {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

export function showFloatingPill(editor, selection) {
  try {
    const selectionText = editor.getModel()?.getValueInRange(selection) || '';
    logDiagnostics(`[Pill] showFloatingPill triggered. length: ${selectionText.length}`);

    const monaco = getMonaco();
    if (!monaco) {
      logDiagnostics('[Pill] Monaco not found in showFloatingPill', 'error');
      return;
    }

    const position = new monaco.Position(selection.endLineNumber, selection.endColumn);
    let scrolledPos = null;
    try {
      if (typeof editor.getScrolledVisiblePosition === 'function') {
        scrolledPos = editor.getScrolledVisiblePosition(position);
      }
    } catch (err) {
      logDiagnostics(`[Pill] Error calling getScrolledVisiblePosition: ${err.message}`, 'error');
    }

    const domNode = editor.getDomNode();
    if (!domNode) {
      logDiagnostics('[Pill] domNode is null/undefined', 'error');
      return;
    }

    if (!scrolledPos) {
      const topOfLine = typeof editor.getTopForLineNumber === 'function'
        ? editor.getTopForLineNumber(position.lineNumber)
        : DEFAULT_LINE_TOP_PX;
      const editorScrollTop = typeof editor.getScrollTop === 'function'
        ? editor.getScrollTop()
        : 0;
      scrolledPos = {
        top: topOfLine - editorScrollTop,
        left: (domNode.clientWidth || DEFAULT_NODE_WIDTH_PX) / 2,
      };
    }

    const rect = domNode.getBoundingClientRect();
    const top = rect.top + scrolledPos.top - PILL_VERTICAL_OFFSET_PX;
    const left = rect.left + scrolledPos.left;

    if (!selectionPill) {
      selectionPill = document.createElement('button');
      selectionPill.id = 'vibescript-selection-pill';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = document.createElementNS(svgNS, 'svg');
      setAttributes(svgEl, {
        width: '11',
        height: '11',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      Object.assign(svgEl.style, {
        marginRight: '4px',
        display: 'inline-block',
        verticalAlign: 'middle',
      });

      const line1 = document.createElementNS(svgNS, 'line');
      setAttributes(line1, { x1: '12', y1: '5', x2: '12', y2: '19' });
      svgEl.appendChild(line1);

      const line2 = document.createElementNS(svgNS, 'line');
      setAttributes(line2, { x1: '5', y1: '12', x2: '19', y2: '12' });
      svgEl.appendChild(line2);

      const spanEl = document.createElement('span');
      spanEl.textContent = 'Attach to VibeScript';
      Object.assign(spanEl.style, { verticalAlign: 'middle' });

      selectionPill.appendChild(svgEl);
      selectionPill.appendChild(spanEl);

      // Position and layout
      Object.assign(selectionPill.style, {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: String(MAX_Z_INDEX),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      });

      // Appearance
      Object.assign(selectionPill.style, {
        padding: '5px 12px',
        backgroundColor: PILL_BG_COLOR,
        color: '#fafafa',
        border: `1px solid ${PILL_BG_HOVER_COLOR}`,
        borderRadius: '9999px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      });

      // Typography and animation
      Object.assign(selectionPill.style, {
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
        lineHeight: '1.2',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.1s ease',
        transform: 'translate(-50%, 0) scale(1)',
        opacity: '1',
      });

      selectionPill.onmouseenter = () => {
        selectionPill.style.backgroundColor = PILL_BG_HOVER_COLOR;
        selectionPill.style.transform = 'translate(-50%, -2px) scale(1.02)';
      };
      selectionPill.onmouseleave = () => {
        selectionPill.style.backgroundColor = PILL_BG_COLOR;
        selectionPill.style.transform = 'translate(-50%, 0) scale(1)';
      };

      document.body.appendChild(selectionPill);
      logDiagnostics('[Pill] Appended floating selection pill to document body', 'success');
    } else {
      selectionPill.style.top = `${top}px`;
      selectionPill.style.left = `${left}px`;
      selectionPill.style.opacity = '1';
      selectionPill.style.transform = 'translate(-50%, 0) scale(1)';
    }

    selectionPill.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const model = editor.getModel();
      if (!model) return;

      const filename = model.uri ? model.uri.path.replace(/^\//, '') : 'untitled.gs';
      const selectedText = model.getValueInRange(selection);

      window.postMessage({
        source: 'vibescript-inject',
        action: 'ATTACH_SELECTION',
        payload: {
          filename,
          content: selectedText,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
        },
      }, '*');

      hideFloatingPill();
    };
  } catch (err) {
    logDiagnostics(`[Pill] Exception in showFloatingPill: ${err.message}`, 'error');
  }
}

export function hideFloatingPill() {
  if (selectionPill) {
    selectionPill.remove();
    selectionPill = null;
  }
}

export function attachSelectionListeners() {
  const monaco = getMonaco();
  if (!monaco || !monaco.editor) return;

  function hookEditor(editor) {
    if (attachedEditors.has(editor)) return;
    attachedEditors.add(editor);
    logDiagnostics('Successfully hooked editor instance!', 'success');

    editor.onDidChangeCursorSelection((e) => {
      try {
        const selection = e.selection;
        const isEmpty = selection ? selection.isEmpty() : true;
        if (selection && !isEmpty) {
          showFloatingPill(editor, selection);
        } else {
          hideFloatingPill();
        }
      } catch (err) {
        logDiagnostics(`[Event] Error in onDidChangeCursorSelection: ${err.message}`, 'error');
      }
    });

    editor.onDidScrollChange(() => { hideFloatingPill(); });
  }

  monaco.editor.getEditors().forEach(hookEditor);
  monaco.editor.onDidCreateEditor((editor) => {
    logDiagnostics('onDidCreateEditor fired.');
    hookEditor(editor);
  });

  let pollCount = 0;
  const pollId = setInterval(() => {
    pollCount++;
    const currentMonaco = window.monaco;
    if (currentMonaco && currentMonaco.editor) {
      currentMonaco.editor.getEditors().forEach(hookEditor);
    }
    if (pollCount >= EDITOR_POLL_LIMIT) {
      clearInterval(pollId);
      console.warn(`[VibeScript] Editor polling stopped after ${EDITOR_POLL_LIMIT} attempts`);
    }
  }, EDITOR_POLL_INTERVAL_MS);

  document.addEventListener('mousedown', (e) => {
    if (selectionPill && !selectionPill.contains(e.target)) {
      setTimeout(() => {
        const editor = getActiveEditor();
        if (editor) {
          const selection = editor.getSelection();
          if (!selection || selection.isEmpty()) hideFloatingPill();
        } else {
          hideFloatingPill();
        }
      }, 100);
    }
  });
}
