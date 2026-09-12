/**
 * Code tabs: the file switcher of the drawer (index.html | styles.css).
 * Clicking the *active* tab reports "pick same" so the editor can use it
 * as a collapse affordance. Renders with classes only.
 */

const $ = s => document.querySelector(s);

export function createCodeTabs({ files, onPick = () => {} } = {}) {
  const strip = $('#file-tabs');
  let active = files[0];

  function render() {
    strip.innerHTML = files.map(f =>
      `<button class="tab${f === active ? ' on' : ''}" data-f="${f}" type="button">${f}</button>`
    ).join('');
    for (const t of strip.querySelectorAll('.tab')) {
      t.onclick = () => t.dataset.f === active ? onPick(active, true) : pick(t.dataset.f);
    }
  }

  function pick(file) {
    // onPick runs while `active` is still the OLD file, so the editor can
    // stash the current buffer before the switch.
    onPick(file, false);
    active = file;
    render();
  }

  render();
  return {
    active: () => active,
    set(file) { active = file; render(); },
  };
}
