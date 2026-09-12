/**
 * Menu: collapse toggle for the toolbar on narrow screens. Toggling the
 * `open` class on <header> is the only thing it does — the wrapping
 * behaviour itself is pure CSS in editor.css.
 */

const $ = s => document.querySelector(s);

export function createMenu() {
  const header = $('header');
  const btn = $('#btn-menu');

  function isOpen() { return header.classList.contains('open'); }

  function toggle(force) {
    const open = force === undefined ? !isOpen() : !!force;
    header.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.onclick = () => toggle();
  return { toggle };
}
