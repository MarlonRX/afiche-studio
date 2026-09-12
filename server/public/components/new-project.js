/**
 * New-project dialog: intentionally non-invasive — the user never shares
 * a whole folder, only one or more STYLESHEETS (.css, or HTML files whose
 * <style> blocks the server can scan). Everything is validated client-side
 * before upload, with graceful fallbacks:
 *
 *   no files / all rejected  -> plain template (the server picks /api/create)
 *   some files rejected      -> they are skipped and the label says why
 *   too many / unreadable    -> capped + skipped, never blocks the flow
 *
 *   createNewProject(ctx, { create }) -> { open(), close() }
 */

const $ = s => document.querySelector(s);

const FALLBACK_LABEL = 'no styles selected \u2014 plain template';
const MAX_FILE = 200 * 1024;          // keep in sync with the server scanner
const MAX_FILES = 24;                 // a dialog is not a zip drop
const STYLE_EXT = /\.(css|html?)$/i;

export function createNewProject(ctx, { create }) {
  const dlg = $('#new-dialog');
  const nameInput = $('#new-name');
  const fileInput = $('#new-file-input');
  const selected = $('#new-selected');
  const createBtn = $('#new-create');
  let chosen = [];   // [{ path, content }]

  function setSelected(note = '') {
    const n = chosen.length;
    const base = n
      ? `${n} style${n === 1 ? '' : 's'} ready (${totalKB()} KB)`
      : FALLBACK_LABEL;
    selected.textContent = note ? `${base} \u00b7 ${note}` : base;
    selected.classList.toggle('has-files', n > 0);
    selected.classList.toggle('warn', !!note && n > 0);
    selected.classList.toggle('empty', !n && !!note);
    createBtn.disabled = !nameInput.value.trim();
  }

  const totalKB = () =>
    chosen.reduce((sum, f) => sum + f.content.length, 0) >> 10;

  async function readPicker(files) {
    chosen = [];
    let rejected = 0, unreadable = 0, capped = false;
    for (const f of files || []) {
      if (!STYLE_EXT.test(f.name) || f.size > MAX_FILE) { rejected++; continue; }
      if (chosen.length >= MAX_FILES) { capped = true; break; }
      try {
        chosen.push({ path: f.name, content: await f.text() });
      } catch { unreadable++; }
    }
    const notes = [];
    if (rejected) notes.push(`${rejected} skipped: not css/html or >200kb`);
    if (unreadable) notes.push(`${unreadable} unreadable`);
    if (capped) notes.push(`max ${MAX_FILES} files`);
    setSelected(notes.join(' \u00b7 '));
  }

  fileInput.addEventListener('change', e => readPicker(e.target.files));
  nameInput.addEventListener('input', () => { createBtn.disabled = !nameInput.value.trim(); });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !createBtn.disabled) createBtn.click();
  });

  $('#new-pick-css').onclick = () => fileInput.click();
  $('#new-cancel').onclick = close;

  createBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const files = chosen.slice();
    close();
    await create({ name, files });   // files=[] -> plain template fallback
  };

  function open() {
    nameInput.value = '';
    chosen = [];
    fileInput.value = '';
    setSelected();
    dlg.hidden = false;
    nameInput.focus();
  }

  function close() { dlg.hidden = true; }

  return { open, close };
}
