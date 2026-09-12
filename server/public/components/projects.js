/**
 * Projects: the two use cases that cross component boundaries.
 *
 *   open(name)   -> store + router + editor files + master variant + preview
 *   create({})   -> /api/scaffold (styles uploaded) or /api/create (template)
 *
 * They only call the components injected; no DOM queries here.
 */

export function createProjects({ store, api, status, editor, toolbar, preview, router }) {
  async function open(name) {
    store.set({ project: name });
    router.sync(name);
    toolbar.setProject(name);
    try {
      await editor.loadAll(name);
    } catch {
      status.set('could not open ' + name, 'err');
      return;
    }
    // Open on the project's master variant (config.preset)
    try {
      const { preset } = await api.json(`/api/preset/${encodeURIComponent(name)}`);
      if (store.state.presets[preset]) toolbar.setActivePreset(preset);
    } catch { /* keep current view */ }
    status.set('opened: ' + name);
    preview.reload();
  }

  async function refreshList() {
    const meta = await api.json('/api/meta');
    store.set({ presets: meta.presets });
    toolbar.setProjects(meta.projects);
    return meta.projects;
  }

  async function create({ name, files }) {
    try {
      let clean;
      let msg;
      if (files.length) {
        const r = await api.json('/api/scaffold', {
          method: 'POST', body: JSON.stringify({ name, files }),
        });
        clean = r.name;
        const m = r.tokens.meta;
        msg = `scaffolded "${clean}" \u2014 ${m.cssFiles} css \u00b7 ${m.colorsFound} colors \u00b7 accent ${r.tokens.colors.accent}`;
      } else {
        const r = await api.json('/api/create', { method: 'POST', body: JSON.stringify({ name }) });
        clean = r.name;
        msg = 'opened: ' + clean;
      }
      await refreshList();
      toolbar.setProject(clean);
      await open(clean);
      status.set(msg);
    } catch (e) {
      status.set(e.message, 'err');
    }
  }

  return { open, create, refreshList };
}
