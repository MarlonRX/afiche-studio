/**
 * Status: the little monospace line in the toolbar. Owns the #status
 * element and its state classes (dirty / err); styling lives in editor.css.
 */

const $ = s => document.querySelector(s);

export function createStatus() {
  const el = $('#status');

  return {
    set(msg, cls = '') {
      el.textContent = msg;
      el.className = 'status ' + cls;
    },
    isDirty() { return el.classList.contains('dirty'); },
  };
}
