/**
 * Api: thin fetch wrapper. `json` parses + throws on error, `text` is for
 * raw files. `projectFile()` builds the URL of an editable project file
 * (index.html | styles.css) — the server allow-lists both.
 */

export function createApi() {
  async function request(path, opts, asText) {
    const r = await fetch(path, opts);
    if (asText) {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
      return r.text();
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.status);
    return data;
  }

  return {
    json: (p, o) => request(p, o, false),
    text: (p, o) => request(p, o, true),

    projectFile(name, file) {
      const q = file && file !== 'index.html' ? '?file=' + encodeURIComponent(file) : '';
      return `/api/project/${encodeURIComponent(name)}${q}`;
    },
  };
}
