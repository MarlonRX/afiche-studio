/**
 * Code editor: transparent textarea over a highlighted <pre>
 * (highlighting done by window.aficheHighlight, loaded as classic script).
 * Owns the collapsible drawer, line numbers, Tab handling, debounced
 * autosave and one buffer per project file (index.html / styles.css),
 * switched through the tabs rendered by code-tabs.js.
 */

import { createCodeTabs } from './code-tabs.js';

const $ = s => document.querySelector(s);
const FILES = ['index.html', 'styles.css'];

export function createCodeEditor(ctx, { onAutosaved = () => {}, onToggled = () => {} } = {}) {
  const ta = $('#code');
  const hl = $('#hl');
  const gutter = $('#gutter');
  let saveTimer = null;
  let project = null;
  const buffers = {};
  const dirty = new Set();

  const tabs = createCodeTabs({
    files: FILES,
    onPick: (file, wasActive) => {
      if (wasActive) { setOpen(false); return; }   // same tab = collapse
      stash();
      tabs.set(file);
      show(file);
    },
  });

  /* ---------- highlight ---------- */

  function refresh() {
    hl.innerHTML = window.aficheHighlight(ta.value) + '\n';
    const lines = ta.value.split('\n').length;
    let nums = '';
    for (let i = 1; i <= lines; i++) nums += i + (i < lines ? '\n' : '');
    gutter.textContent = nums;
    syncScroll();
  }

  function syncScroll() {
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
    gutter.scrollTop = ta.scrollTop;
  }

  function stash() { buffers[tabs.active()] = ta.value; }

  function show(file) {
    ta.value = buffers[file] || '';
    refresh();
  }

  /* ---------- loading / saving (debounced autosave) ---------- */

  async function loadAll(name) {
    project = name;
    await Promise.all(FILES.map(async f => {
      buffers[f] = await ctx.api.text(ctx.api.projectFile(name, f)).catch(() => '');
    }));
    dirty.clear();
    tabs.set(FILES[0]);
    show(FILES[0]);
  }

  async function save(quiet = false) {
    clearTimeout(saveTimer);
    if (!project) return;
    stash();
    const pending = dirty.size ? [...dirty] : [tabs.active()];
    try {
      for (const f of pending) {
        await ctx.api.json(ctx.api.projectFile(project, f), { method: 'PUT', body: buffers[f] });
      }
      dirty.clear();
      if (!quiet || ctx.status.isDirty()) {
        ctx.status.set('saved \u2713 ' + new Date().toLocaleTimeString());
      }
    } catch (e) {
      ctx.status.set('error: ' + e.message, 'err');
    }
  }

  ta.addEventListener('input', () => {
    ctx.status.set('unsaved\u2026', 'dirty');
    dirty.add(tabs.active());
    refresh();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(true).then(onAutosaved), 2000);
  });

  ta.addEventListener('scroll', syncScroll);

  ta.addEventListener('keydown', e => {
    // Tab inside the editor inserts two spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, t = ta.selectionEnd;
      ta.setRangeText('  ', s, t, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });

  /* ---------- collapsible drawer ---------- */

  function isOpen() { return document.body.classList.contains('editor-open'); }

  function setOpen(open) {
    document.body.classList.toggle('editor-open', open);
    $('#btn-toggle-code').classList.toggle('toggle-on', open);
    if (open) { refresh(); ta.focus(); }
    setTimeout(onToggled, 280);   // let the drawer animation finish
  }

  $('#code-rail').onclick = () => setOpen(true);
  $('#btn-toggle-code').onclick = () => setOpen(!isOpen());

  return { loadAll, save, setOpen, isOpen, file: () => tabs.active() };
}
