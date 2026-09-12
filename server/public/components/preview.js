/**
 * Preview: iframe sized to the current variant with zoom controls
 * (0 = fit to the visible area, else a manual factor). The available
 * area is MEASURED from the DOM — CSS owns every padding (including the
 * drawer offset) and a ResizeObserver re-fits whenever the layout
 * changes, so the poster always fits, at any window size.
 */

const $ = s => document.querySelector(s);

export function createPreview(ctx) {
  const holder = $('#frame-holder');
  const frame = $('#preview');
  const wrap = $('#preview-wrap');
  let zoom = 0;   // 0 means "fit to available area"

  function reload() {
    if (!ctx.store.state.project) return;
    const p = ctx.presetDims();
    holder.style.setProperty('--pw', p.width + 'px');
    holder.style.setProperty('--ph', p.height + 'px');
    frame.src = `/proj/${encodeURIComponent(ctx.store.state.project)}/index.html?t=` + Date.now();
    applyZoom();
  }

  /** Visible content box of the stage, minus its CSS padding + slack. */
  function available() {
    const cs = getComputedStyle(wrap);
    return {
      w: wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8,
      h: wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8,
    };
  }

  function applyZoom() {
    const p = ctx.presetDims();
    let z = zoom;
    if (z === 0) {
      const a = available();
      z = Math.max(Math.min(a.w / p.width, a.h / p.height, 1), 0.05);
    }
    // JS only publishes numbers; scale(), margins and size are computed in CSS.
    holder.style.setProperty('--z', z);
    $('#zoom-label').textContent = Math.round(z * 100) + '%';
  }

  // Live reload: the server broadcasts 'reload' after every save
  new EventSource('/events').addEventListener('reload', reload);

  // Auto-fit on any layout change (window resize, drawer, panel stacking)
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (zoom === 0) applyZoom(); }).observe(wrap);
  } else {
    window.addEventListener('resize', () => { if (zoom === 0) applyZoom(); });
  }

  return {
    reload,
    refit() { if (zoom === 0) applyZoom(); },
    zoomIn() { zoom = (zoom || 0.25) * 1.25; applyZoom(); },
    zoomOut() { zoom = (zoom || 1) / 1.25; applyZoom(); },
    fit() { zoom = 0; applyZoom(); },
  };
}
