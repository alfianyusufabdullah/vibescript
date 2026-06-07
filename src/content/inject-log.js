export function logDiagnostics(message, type = 'info') {
  console.log(`[VibeScript Inject] ${message}`);
  window.postMessage({
    source: 'vibescript-inject',
    action: 'DIAGNOSTICS_LOG',
    payload: { message, type }
  }, '*');
}
