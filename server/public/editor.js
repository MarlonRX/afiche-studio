/**
 * Afiche Studio — bootstrap. Only wires the pieces of ./components/,
 * one responsibility each:
 *
 *   store.js         app state            api.js          fetch helpers
 *   status.js        status line          router.js       ?project= in URL
 *   menu.js          toolbar collapse     shortcuts.js    Ctrl+S / E / Esc
 *   projects.js      open + create        toolbar.js      selector + chips
 *   code-editor.js   drawer + autosave    code-tabs.js    file switcher
 *   preview.js       iframe + auto-fit    export-panel.js render dialog
 *   new-project.js   create/scaffold dialog
 */

import { createStore } from './components/store.js';
import { createApi } from './components/api.js';
import { createStatus } from './components/status.js';
import { createRouter } from './components/router.js';
import { createMenu } from './components/menu.js';
import { createShortcuts } from './components/shortcuts.js';
import { createProjects } from './components/projects.js';
import { createToolbar } from './components/toolbar.js';
import { createCodeEditor } from './components/code-editor.js';
import { createPreview } from './components/preview.js';
import { createExportPanel } from './components/export-panel.js';
import { createNewProject } from './components/new-project.js';

const api = createApi();
const status = createStatus();
const store = createStore({ project: null, presets: {}, viewPreset: 'wide' });

/** Shared context every component receives. */
const ctx = {
  api, status, store,
  presetDims: () => store.state.presets[store.state.viewPreset] || { width: 1080, height: 1080 },
};

const preview = createPreview(ctx);
const code = createCodeEditor(ctx, { onAutosaved: preview.reload, onToggled: preview.refit });
const exportPanel = createExportPanel(ctx, { save: () => code.save() });
const newProject = createNewProject(ctx, { create: opts => projects.create(opts) });
const toolbar = createToolbar(ctx, {
  onSelectProject: name => projects.open(name),
  onNewProject: () => newProject.open(),
  onSave: () => code.save().then(preview.reload),
  onViewPreset: preview.reload,
  zoom: preview,
});
const menu = createMenu();
const router = createRouter(store, { open: name => projects.open(name) });
const projects = createProjects({ store, api, status, editor: code, toolbar, preview, router });

createShortcuts({
  onSave: () => code.save().then(preview.reload),
  onToggleCode: () => code.setOpen(!code.isOpen()),
  onCloseOverlay: () => { newProject.close(); exportPanel.close(); menu.toggle(false); },
});

/* ---------- boot ---------- */

(async function boot() {
  const meta = await api.json('/api/meta').catch(err => { status.set(err.message, 'err'); return null; });
  if (!meta) return;

  store.set({ presets: meta.presets });
  toolbar.setProjects(meta.projects);
  toolbar.buildChips();
  exportPanel.buildVariants();
  code.setOpen(false);

  if (!meta.projects.length) { status.set('no projects \u2014 click "+ New"', 'dirty'); return; }
  const wanted = router.current();
  projects.open(meta.projects.includes(wanted) ? wanted : meta.projects[0]);
})();
