/**
 * Shortcuts: the single global keydown listener. It just decodes the
 * chords and delegates — the orchestrator passes the callbacks:
 *
 *   Ctrl/Cmd+S   save + reload preview
 *   Ctrl/Cmd+E   toggle the code drawer
 *   Escape       close the top-most overlay
 */

export function createShortcuts({ onSave, onToggleCode, onCloseOverlay }) {
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;          // a component already handled it
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave();
    } else if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      onToggleCode();
    } else if (e.key === 'Escape') {
      onCloseOverlay();
    }
  });
}
