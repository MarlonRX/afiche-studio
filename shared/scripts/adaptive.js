/* Afiche Studio — Adaptive kit (runtime)
 * Reads the real size of #canvas (forced by the CLI / the editor per
 * requested variant) and exposes:
 *   --W, --H        dimensions in px
 *   --S             scale relative to the 1080 base mockup
 *   data-orient     square | wide | tall
 *   data-ratio      width/height with 2 decimals
 * It also fires 'afiche:resize' for projects that need their own JS.
 */
(function () {
  function apply() {
    var c = document.getElementById('canvas');
    if (!c) return;
    // Inside the editor iframe, the viewport IS the requested variant:
    // the canvas stretches to it. In a normal window it keeps its CSS size.
    if (window.top !== window.self) {
      c.style.width  = window.innerWidth  + 'px';
      c.style.height = window.innerHeight + 'px';
    }
    var w = c.offsetWidth  || 1080;
    var h = c.offsetHeight || 1080;
    var r = w / h;
    c.style.setProperty('--W', w + 'px');
    c.style.setProperty('--H', h + 'px');
    c.style.setProperty('--S', (Math.min(w, h) / 1080).toFixed(4));
    c.dataset.orient = r > 1.32 ? 'wide' : (r < 0.76 ? 'tall' : 'square');
    c.dataset.ratio  = r.toFixed(2);
    window.dispatchEvent(new CustomEvent('afiche:resize', { detail: { w: w, h: h, orient: c.dataset.orient } }));

    var b = c.getBoundingClientRect(), worst = 0;
    c.querySelectorAll('*').forEach(function (el) {
      var r = e.getBoundingClientRect();
      if(!r.height) return;
      worst = Math.max(worst, r.bottom - b.bottom, b.top - r.top);
    });
    c.dataset.overflow = Math.round(worst);

  }
  window.__aficheAdapt = apply;

  function boot() {
    apply();
    // Re-adapt every time the renderer (editor or CLI) forces another size
    var c = document.getElementById('canvas');
    if (c && 'ResizeObserver' in window) {
      new ResizeObserver(apply).observe(c);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
