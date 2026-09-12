'use strict';

/**
 * Scaffold scanner: walks a web app folder, reads its global styles
 * (.css files and <style> blocks) and extracts design tokens without
 * any dependency — pure regex heuristics, good enough to scaffold a
 * generic poster.
 *
 * Returns a `tokens` object consumed by ./generate.js.
 */

const fs = require('fs');
const path = require('path');

/** Directories that never hold project-level global styles. */
const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.git', '.svn', '.hg',
  '.next', '.nuxt', '.cache', '.turbo', '.nx', 'vendor', 'coverage',
  '__pycache__', '.idea', '.vscode',
]);

const MAX_FILE_SIZE = 200 * 1024;   // skip minified/font files that are huge
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const RE = {
  // <style> blocks inside HTML
  styleBlock: /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi,
  // any declaration: property : value ;
  decl: /([a-zA-Z][\w-]*)\s*:\s*([^;}\n]+);/g,
  // --custom-property: value ;
  varDecl: /(--[\w-]+)\s*:\s*([^;}\n]+);/g,
  // google fonts <link>
  googleLink: /fonts\.googleapis\.com\/css2\?family=([^'"]+)/gi,
  // border-radius value
  radius: /border-radius\s*:\s*([0-9.]+(?:px|em|rem)?)/g,
};

/** Absolute values used as generic fallbacks when nothing was detected. */
const FALLBACK = {
  background: '#0f0f12', surface: '#1a1a1f', text: '#e1e1e1',
  accent: '#d4af37', border: '#2a2a30', error: '#cf666b', success: '#2e8b57',
};

/* ------------------------------------------------------------ color utils */

/**
 * Normalize any hex input to a lowercase 6-digit value WITH the `#`
 * prefix ('#ff5500'), or null when it is not a valid hex color.
 * That is the convention used by every token.
 */
function normalizeHex(input) {
  let h = String(input).trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);
  if (!/^[0-9a-f]{3,8}$/.test(h)) return null;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.split('').map(c => c + c).join('');   // #rgba -> 8
  if (h.length === 6) return '#' + h;
  if (h.length === 8) return '#' + h.slice(0, 6);                  // drop alpha
  return null;
}

function rgbToHex(r, g, b) {
  const c = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return c(r) + c(g) + c(b);
}

/** Extract + normalize every color token from a value string. */
function colorsIn(value) {
  const out = [];
  const hex = /#[0-9a-fA-F]{3,8}\b/g;
  let m;
  while ((m = hex.exec(value))) {
    const n = normalizeHex(m[0]);
    if (n) out.push(n);
  }
  const rgb = /rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[0-9.]+%?\s*)?\)/g;
  while ((m = rgb.exec(value))) {
    const p = v => v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v);
    out.push(rgbToHex(p(m[1]), p(m[2]), p(m[3])));
  }
  return out;
}

/** 0-360 hue, 0-1 sl, for neutral/saturation heuristics. */
function hexToHsl(hex) {
  const n = parseInt(hex.replace(/^#/, ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

/** Mix two hex colors, t goes from first (0) to second (1). */
function mix(a, b, t) {
  const pa = parseInt(a.replace(/^#/, ''), 16);
  const pb = parseInt(b.replace(/^#/, ''), 16);
  const ch = (i) => {
    const x = ((pa >> i) & 255) * (1 - t) + ((pb >> i) & 255) * t;
    return Math.round(x).toString(16).padStart(2, '0');
  };
  return '#' + ch(16) + ch(8) + ch(0);
}

/* ------------------------------------------------------------ classification */

const KIND_RE = {
  bg: /background|fill|canvas|base|dark|deep/,
  text: /text|foreground|fg|ink|content/,
  accent: /accent|primary|brand|highlight|action|active|cta|button|link|main/,
  surface: /surface|panel|card|raised|elevat|muted|secondary|border|line|stroke|divider/,
};

function classify(name) {
  if (KIND_RE.accent.test(name)) return 'accent';
  if (KIND_RE.bg.test(name)) return 'bg';
  if (KIND_RE.surface.test(name)) return 'surface';
  if (KIND_RE.text.test(name)) return 'text';
  return null;
}

/* ------------------------------------------------------------ font utils */

const GENERIC = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'symbol',
  'inherit', 'initial', 'unset', 'var(--font-sans)', 'var(--font-sans-serif)',
  'var(--font-mono)', 'var(--font-serif)', 'var(--font-body)', '-apple-system',
]);

function familiesIn(value) {
  return value
    .split(',')
    .map(f => f.replace(/^["']|["']$/g, '').replace(/^var\(|\)$/g, '').trim())
    .filter(f => f && !GENERIC.has(f.toLowerCase()));
}

/* ------------------------------------------------------------ main scan */

/**
 * Recursively collect everything that may hold global styles.
 * @returns {{ css: string[], files: string[], googleFamilies: string[] }}
 */
function collect(appDir) {
  const css = [];
  const files = [];
  const googleFamilies = [];
  const links = [];
  let total = 0;

  function statOk(file) {
    let st;
    try { st = fs.statSync(file); } catch { return false; }
    if (!st.isFile() || st.size > MAX_FILE_SIZE || total + st.size > MAX_TOTAL_BYTES) return false;
    total += st.size;
    return true;
  }

  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) walk(full);
      } else if (e.isFile() && statOk(full)) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.css') {
          css.push(fs.readFileSync(full, 'utf8'));
          files.push(full);
        } else if (ext === '.html' || ext === '.htm') {
          const html = fs.readFileSync(full, 'utf8');
          for (const m of html.matchAll(RE.styleBlock)) css.push(m[1]);
          if (css.length) files.push(full);
          for (const l of html.matchAll(RE.googleLink)) links.push(l[1]);
          googleFamilies.push(...links.flatMap(l => parseGoogleFamily(l)));
        }
      }
    }
  })(appDir);

  return { css, files, googleFamilies };
}

function parseGoogleFamily(param) {
  // e.g. "Inter:wght@400;600&family=Space+Grotesk:wght@700"
  return param.split('&family=').map(s => s.split(':')[0].replace(/\+/g, ' '));
}

/* ------------------------------------------------------------ analysis */

function analyze(css, googleFamilies) {
  const varColors = new Map();        // --name -> normalized hex
  const declColors = new Map();       // color -> { count, kinds:Set }
  const familyCounts = new Map();     // family -> count
  const radii = new Map();            // radius -> count
  const seenVars = new Map();

  for (const sheet of css) {
    // CSS custom properties (also catches :root blocks)
    for (const [, name, value] of sheet.matchAll(RE.varDecl)) {
      seenVars.set(name, value.trim());
      const hex = colorsIn(value)[0] || normalizeHex(value);
      if (hex && !hex.includes('var(')) varColors.set(name, hex);
    }
    // declarations, with a kind hint for their property
    for (const [, prop, value] of sheet.matchAll(RE.decl)) {
      for (const c of colorsIn(value)) {
        let e = declColors.get(c);
        if (!e) { e = { count: 0, kinds: new Set() }; declColors.set(c, e); }
        e.count++;
        const k = classify(prop);
        if (k) e.kinds.add(k);
      }
      const fam = /^font-family$/i.test(prop)
        ? familiesIn(value).filter(f => f)
        : [];
      fam.forEach(f => familyCounts.set(f, (familyCounts.get(f) || 0) + 1));
      const shot = value.split(' ')[0];
      if (/^border-radius$/i.test(prop) && RE.radius.test(sheet)) {
        const m = RE.radius.exec(sheet);
        if (m) radii.set(m[1], (radii.get(m[1]) || 0) + 1);
      }
    }
  }

  /* ---- pick a candidate by keyword in the var name ---- */
  function fromVar(kind) {
    const want = /accent|primary|brand|highlight|action|cta|button|link/
      .test.bind(KIND_RE.accent);
    for (const [name, hex] of varColors) {
      if (kind === 'accent' && /accent|primary|brand|main|highlight|action|cta|link|button/i.test(name)) return hex;
      if (kind === 'bg' && /(^|-)(bg|background|canvas|base|dark|deep)/i.test(name)) return hex;
      if (kind === 'text' && /(^|-)(text|fg|foreground|ink|content)/i.test(name)) return hex;
      if (kind === 'surface' && /(^|-)(surface|panel|card|raised|elev|border|line|stroke|muted|secondary)/i.test(name)) return hex;
    }
    return null;
  }

  /* ---- most frequent color whose declared context matches the kind ---- */
  function fromDecls(kind) {
    let best = null, bestE = null;
    for (const [c, e] of declColors) {
      if (!e.kinds.has(kind)) continue;
      // accents must be vivid; background/text can be any dark/light tone
      if (kind === 'accent' && isNeutralish(c)) continue;
      if (!bestE || e.count > bestE.count) { best = c; bestE = e; }
    }
    return best;
  }

  return {
    varColors, declColors, familyCounts, radii,
    seenVars,
    fromVar, fromDecls,
  };
}

/** Not close to grey, and not pure black/white — a plausible accent. */
function isNeutralish(hex) {
  const { s, l } = hexToHsl(hex);
  return s < 0.18 || l < 0.08 || l > 0.96;
}

/* ------------------------------------------------------------ token picking */

function mostFrequent(map, filter = () => true) {
  let best = null, n = -1;
  for (const [k, v] of map) {
    if (filter(k) && v > n) { best = k; n = v; }
  }
  return best;
}

function pickAccent(a) {
  const c = a.fromVar('accent') || a.fromDecls('accent');
  if (c && !isNeutralish(c)) return c;
  // nothing semantic: most used non-neutral
  const freq = mostFrequent(a.declColors, k => !isNeutralish(k));
  if (freq) return freq;
  const l = mix(FALLBACK.accent, '#ffffff', .5);
  return l;
}

function pickBackground(a) {
  return a.fromVar('bg')
    || a.fromDecls('bg')
    || mostFrequent(a.declColors, k => hexToHsl(k).l < 0.5)   // dark wins
    || FALLBACK.background;
}

function pickText(a, bg) {
  const t = a.fromVar('text') || a.fromDecls('text');
  if (t) return t;
  // lightest frequent color = likely the text
  const light = mostFrequent(a.declColors, k => hexToHsl(k).l > 0.5 && isNeutralish(k));
  if (light) return light;
  return hexToHsl(bg).l < 0.5 ? '#e8e8e8' : '#141414';
}

function pickSurface(a, bg, text) {
  const s = a.fromVar('surface') || a.fromDecls('surface');
  if (s) return s;
  return mix(bg, text, 0.12);
}

function pickFonts(a, googleFamilies) {
  const candidates = new Map(a.familyCounts);
  for (const fam of googleFamilies) {
    candidates.set(fam, (candidates.get(fam) || 0) + 5);
  }
  const sorted = [...candidates.entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]);
  const mono = sorted.find(f => /mono|code|fira/i.test(f));
  const display = sorted.find(f => f !== mono);
  const body = sorted.find(f => f !== mono && f !== display);
  return {
    display: display || 'Space Grotesk',
    body: body || 'Inter',
    mono: mono || 'JetBrains Mono',
    googleImport: googleFamilies.length
      ? googleFamilies.map(f => f.trim()).join('|')
      : '',
  };
}

/* ------------------------------------------------------------ public */

/**
 * Scan an app folder and produce design tokens for the poster.
 * @param {string} appDir
 * @returns {{ colors, fonts, radius, meta }}
 */
function scan(appDir) {
  const { css, files, googleFamilies } = collect(appDir);

  const a = analyze(css, googleFamilies);

  const background = pickBackground(a);
  const text = pickText(a, background);
  const accent = pickAccent(a);
  const surface = pickSurface(a, background, text);

  // border/line color: explicit keyword var first, then surface, then a mix
  const border = a.fromVar('surface')
    || a.varColors.get('--line')
    || a.varColors.get('--border')
    || a.varColors.get('--stroke')
    || mix(background, text, 0.55);

  const radius = mostFrequent(a.radii) || '12px';
  const fonts = pickFonts(a, googleFamilies);
  const error = a.varColors.get('--error') ?? FALLBACK.error;
  const success = a.varColors.get('--success') ?? FALLBACK.success;

  return {
    colors: {
      background,
      surface,
      text,
      muted: mix(text, background, 0.42),
      accent,
      accent2: mix(accent, '#ffffff', 0.22),
      border,
      error,
      success,
    },
    fonts,
    radius,
    meta: {
      cssFiles: files.length,
      styleBlocks: css.length - files.filter(f => /\.css$/i.test(f)).length,
      colorsFound: a.declColors.size,
      fontsFound: a.familyCounts.size,
      rootVars: a.varColors.size,
    },
  };
}

module.exports = { scan, normalizeHex, mix, hexToHsl, MAX_FILE_SIZE };