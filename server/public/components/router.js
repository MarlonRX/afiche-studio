/**
 * Router: keeps the opened project in the URL (?project=name) so a
 * refresh — or a shared link — lands on the same poster. The router
 * only reads/writes the query string; opening is delegated upward.
 */

const $ = s => document.querySelector(s);

export function createRouter(store, { open }) {
  function current() {
    return new URLSearchParams(location.search).get('project');
  }

  function sync(name) {
    const url = new URL(location.href);
    url.searchParams.set('project', name);
    history.replaceState(null, '', url);
  }

  // Back/forward between full pages: re-open whatever the URL says.
  window.addEventListener('popstate', () => {
    const n = current();
    if (n && n !== store.state.project) open(n);
  });

  return { current, sync };
}
