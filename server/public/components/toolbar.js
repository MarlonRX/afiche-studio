/**
 * Toolbar: project selector, "+ New", Save, variant chips and zoom
 * buttons. It only updates `ctx.store` and delegates through the
 * injected callbacks — the reactions (preview reload, refit) are wired
 * in editor.js. The narrow-screen collapse lives in components/menu.js.
 */

const $ = s => document.querySelector(s);

export function createToolbar(ctx, { onSelectProject, onNewProject, onSave, onViewPreset, zoom }) {
  const sel = $('#project');
  const chips = $('#chips');

  function buildChips() {
    chips.innerHTML = Object.entries(ctx.store.state.presets).map(([k, v]) =>
      `<button class="chip${k === ctx.store.state.viewPreset ? ' on' : ''}" data-p="${k}" type="button">` +
      `${v.label} <small>${v.width}&#215;${v.height}</small></button>`
    ).join('');
    for (const c of chips.querySelectorAll('.chip')) {
      c.onclick = () => { setActivePreset(c.dataset.p); onViewPreset(); };
    }
  }

  function setActivePreset(key) {
    ctx.store.set({ viewPreset: key });
    for (const x of chips.querySelectorAll('.chip')) x.classList.toggle('on', x.dataset.p === key);
  }

  function setProjects(list) {
    sel.innerHTML = list.map(p => `<option>${p}</option>`).join('');
  }

  sel.onchange = e => onSelectProject(e.target.value);
  $('#btn-new').onclick = onNewProject;
  $('#btn-save').onclick = onSave;
  $('#btn-zoom-in').onclick = zoom.zoomIn;
  $('#btn-zoom-out').onclick = zoom.zoomOut;
  $('#btn-zoom-fit').onclick = zoom.fit;

  return { setProjects, setProject: name => { sel.value = name; }, setActivePreset, buildChips };
}
