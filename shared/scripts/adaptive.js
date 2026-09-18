/* Afiche Studio — Adaptive kit (runtime)
 * Reads the real size of #canvas (forced by the CLI / the editor per
 * requested variant) and exposes:
 *   --W, --H        dimensions in px
 *   --S             scale relative to the 1080 base mockup
 *   data-orient     square | wide | tall
 *   data-ratio      width/height with 2 decimals
 * It also fires 'afiche:resize' for projects that need their own JS.
 *
 * Hot-path rules (dev CPU): apply() must be a no-op when nothing changed,
 * must never write styles it didn't need to write, and the ResizeObserver
 * callback is rAF-debounced so resize bursts collapse into one pass.
 */
(function () {
  var last = { w: 0, h: 0 };

  function apply() {
    var c = document.getElementById('canvas');
    if (!c) return;
    // Inside the editor iframe, the viewport IS the requested variant:
    // the canvas stretches to it. In a normal window it keeps its CSS size.
    if (window.top !== window.self) {
      var vw = window.innerWidth + 'px';
      var vh = window.innerHeight + 'px';
      if (c.style.width !== vw)  c.style.width  = vw;
      if (c.style.height !== vh) c.style.height = vh;
    }
    var w = c.offsetWidth  || 1080;
    var h = c.offsetHeight || 1080;
    // Nothing actually changed: stop before writing vars / firing events.
    // This is what keeps the ResizeObserver from feeding itself.
    if (w === last.w && h === last.h) return;
    last.w = w; last.h = h;
    var r = w / h;
    c.style.setProperty('--W', w + 'px');
    c.style.setProperty('--H', h + 'px');
    c.style.setProperty('--S', (Math.min(w, h) / 1080).toFixed(4));
    c.dataset.orient = r > 1.32 ? 'wide' : (r < 0.76 ? 'tall' : 'square');
    c.dataset.ratio  = r.toFixed(2);
    window.dispatchEvent(new CustomEvent('afiche:resize', { detail: { w: w, h: h, orient: c.dataset.orient } }));
  }
  window.__aficheAdapt = apply;

  function boot() {
    apply();
    // Re-adapt every time the renderer (editor or CLI) forces another size,
    // coalesced to one pass per animation frame.
    var c = document.getElementById('canvas');
    if (c && 'ResizeObserver' in window) {
      var pending = false;
      new ResizeObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; apply(); });
      }).observe(c);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
