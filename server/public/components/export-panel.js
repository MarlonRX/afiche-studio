/**
 * Export panel: format / variant / scale pickers + render, shows
 * download links for every generated file. Renders through classes
 * only (.out-size, .out-error) — no style strings in JS.
 */

const $ = s => document.querySelector(s);

/** The render names are server-side safe, but escape anyway (HTML sink). */
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createExportPanel(ctx, { save }) {
  const panel = $('#export-panel');
  const out = $('#export-out');

  $('#btn-export').onclick = () => panel.classList.toggle('open');

  function close() { panel.classList.remove('open'); }

  function buildVariants() {
    $('#variant-group').innerHTML = Object.entries(ctx.store.state.presets).map(([k, v]) =>
      `<label class="opt"><input type="checkbox" value="${k}" ${k === 'post' || k === 'wide' ? 'checked' : ''}> ${v.label}</label>`
    ).join('');
  }

  $('#btn-render').onclick = async () => {
    const btn = $('#btn-render');
    const formats = [...document.querySelectorAll('#fmt-group input:checked')].map(i => i.value);
    const variants = [...document.querySelectorAll('#variant-group input:checked')].map(i => i.value);
    const scale = document.querySelector('input[name=scale]:checked').value;
    if (!formats.length || !variants.length) { ctx.status.set('choose a format and a variant', 'err'); return; }

    btn.disabled = true;
    btn.textContent = 'Rendering\u2026'; btn.classList.add('busy');
    out.innerHTML = '';
    try {
      await save();
      const r = await ctx.api.json('/api/export', {
        method: 'POST',
        body: JSON.stringify({ project: ctx.store.state.project, formats, presets: variants, scale }),
      });
      out.innerHTML = r.outputs.map(o =>
        `<a href="${esc(o.url)}" download>\u2193 ${esc(o.file)} <span class="out-size">(${esc(o.kb)} KB)</span></a>`
      ).join('');
      ctx.status.set(`${r.outputs.length} images ready in outputs/`);
    } catch (e) {
      out.innerHTML = `<span class="out-error">${esc(e.message)}</span>`;
      ctx.status.set('export failed', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Render'; btn.classList.remove('busy');
    }
  };

  return { buildVariants, close };
}
