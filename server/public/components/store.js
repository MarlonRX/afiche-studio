/**
 * Store: the single source of truth for app state (project, presets,
 * viewPreset). Components read `store.state` and mutate via `store.set()`,
 * which notifies subscribers. No DOM here.
 */

export function createStore(initial = {}) {
  const listeners = new Set();
  const state = { ...initial };

  return {
    state,

    set(patch) {
      Object.assign(state, patch);
      for (const fn of listeners) fn(state);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
