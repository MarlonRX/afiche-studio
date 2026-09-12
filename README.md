# Afiche Studio

Generador de imágenes promocionales (PNG / WEBP / JPG) desde plantillas HTML/CSS,
con un editor en el navegador. Hermano de `hyper-frames-videos`: misma filosofía
y paleta de marca, pero en vez de video frame a frame produce una sola imagen
de alta resolución. Pensado para **self-host**: todo corre en tu máquina, sin
cuenta, sin nube, sin telemetría.

Built for: social posts, thumbnails, banners, product cards, project notices.

**Idioma:** Español · [English](#english)

---

## Español

### Requisitos

- **Node.js 18+** (usa `node:test` y APIs de fs modernas).
- ~200 MB de espacio: Puppeteer descarga su propio Chrome/Chromium al instalar.
- Conexión a internet solo en dos momentos: `npm install` y las fuentes de
  Google Fonts que usan los proyectos (sin red, caen a la fuente del sistema —
  el diseño no se rompe).

### Instalación (self-host)

```bash
git clone <tu-remote> afiche-studio   # o copia la carpeta del proyecto
cd afiche-studio
npm install                           # descarga Chrome para Puppeteer
npm test                              # 27 tests, sin dependencias extra
```

Sin permisos especiales ni variables obligatorias. `outputs/` es el único
directorio que se escribe fuera de `projects/` al renderizar.

### Modo studio (recomendado)

```bash
npm run dev        # abre http://localhost:4560 en una sola pestaña
```

Editor en vivo:

- **Código:** pestañas `index.html` y `styles.css` de cada proyecto
  (autoguardado a los 2 s y con `Ctrl+S`).
- **Preview:** iframe recargado al instante, con chips para ver el mismo
  diseño en cada variante (`post`, `story`, `thumb`, `banner`, `og`, `wide`)
  y auto-zoom responsive (baja hasta ~700 px de ancho).
- **Export…**: panel flotante para generar variantes en **PNG / WEBP / JPG**
  a escala 1x–3x. Los archivos caen en `outputs/` con links de descarga.
- **+ New**: crea proyectos desde la plantilla. Opcionalmente adjuntas **uno o
  varios archivos de estilos** (`.css`, o HTML con bloques `<style>`): nunca se
  pide ni se sube una carpeta con tu código. Sin archivos → plantilla simple.
- **URL compartible**: `?project=<nombre>` abre ese proyecto directo.

Lo que guardás acá es exactamente lo que el CLI renderiza después.

Variables de entorno del server:

| Variable         | Efecto                                        |
|------------------|-----------------------------------------------|
| `PORT`           | cambiar el puerto (default `4560`)            |
| `AFICHE_NO_OPEN` | no abrir el navegador automáticamente         |

### CLI

```bash
node cli/afiche.js --list                    # listar proyectos
node cli/afiche.js --create mi-post          # crear desde la plantilla
node cli/afiche.js --preview mi-post         # abrir el HTML en el navegador
node cli/afiche.js mi-post                   # generar PNG (preset del config)
node cli/afiche.js mi-post --preset story    # otra variante
node cli/afiche.js mi-post --preset thumb --scale 3
node cli/afiche.js --all                     # renderizar todo
node cli/afiche.js mi-post --app /ruta/app   # scaffold escaneando el CSS global de una app
```

El `--app` del CLI sí recorre una carpeta local (salta `node_modules`, `dist`,
`build`, `.next`, …), pero todo ocurre en tu máquina: extrae tokens de diseño
(colores de `:root`, fuentes, `border-radius`) y genera un póster genérico que
podés editar y exportar. Es una heurística: un punto de partida, no un clon.

### Cómo se diseña

1. Cada proyecto es una carpeta en `projects/` con `index.html` + `styles.css`
   + `config.json`. El lienzo es el elemento `#canvas`.
2. El texto vive en el HTML; el diseño en `styles.css` (enlazado después de
   `shared/styles/brand.css` y `adaptive.css`).
3. Colores de marca: variables en `shared/styles/brand.css` — editás ahí y
   todos los proyectos se actualizan.
4. `shared/styles/adaptive.css` + `shared/scripts/adaptive.js` exponen
   `--W / --H / --S` y `data-orient` según la variante forzada, así un solo
   diseño sirve para todos los formatos.
5. Probá en el studio y exportá con `node cli/afiche.js mi-post`.

### Presets

| Preset   | Size         | Use                    |
|----------|--------------|------------------------|
| `post`   | 1080 x 1080  | Instagram / Facebook   |
| `story`  | 1080 x 1920  | Stories / Reels        |
| `thumb`  | 1280 x 720   | YouTube thumbnail      |
| `banner` | 1500 x 500   | X / LinkedIn           |
| `og`     | 1200 x 630   | Open Graph (links)     |

El render aplica `deviceScaleFactor` (2 por default): un `post` sale de
2160 x 2160 px, nítido para retina y zoom.

### Configuración por proyecto (`config.json`)

```json
{
  "name": "mi-post",
  "title": "My Promotional Post",
  "preset": "post",
  "width": 1080,
  "height": 1080,
  "scale": 2,
  "outputFormat": "png",
  "brand": { "colors": { "accent": "#d4af37" } }
}
```

`width`/`height` solo importan con dimensiones custom; los presets de la tabla
mandan sobre ellas y las flags `--width/--height` mandan sobre todo.

### Estructura

```
afiche-studio/
├── src/                        # Núcleo: lógica de negocio (sin HTTP, sin argv)
│   ├── presets.js              # PRESETS + defaults (única fuente de verdad)
│   ├── config.js               # Paths y puerto
│   ├── projects/               # registry (list/read/paths) + creator (templates/)
│   ├── render/                 # browser.js (Puppeteer singleton) + renderer.js
│   └── scaffold/               # scan.js + generate.js + index.js (tokens → póster)
├── cli/afiche.js               # Solo commander: mapea flags → src/
├── server/
│   ├── index.js                # Bootstrap HTTP (wiring de rutas)
│   ├── http-utils.js           # send / readBody / safeJoin / MIME
│   ├── routes/                 # api.js · static.js · sse.js (live reload)
│   └── public/                 # Editor (ES modules, vanilla)
│       ├── index.html · editor.css · editor.js · editor-highlight.js
│       └── components/         # store · api · status · router · menu · shortcuts ·
│                               # projects · toolbar · code-editor · code-tabs ·
│                               # preview · export-panel · new-project
├── shared/                     # Runtime de los canvas (brand.css, adaptive.*)
├── templates/                  # Plantilla base (index.html + styles.css + config.json)
├── projects/                   # Tus diseños (index.html + styles.css + config.json)
├── outputs/                    # Renders generados (gitignored)
└── tests/                      # node:test, sin dependencias
```

### Troubleshooting

- **Puppeteer no encuentra Chrome** (red limitada): `npx puppeteer browsers install chrome`.
- **No abre el navegador solo**: entrá a `http://localhost:4560` a mano, o
  corré con `AFICHE_NO_OPEN=1`.
- **Puerto ocupado**: `PORT=4570 npm run dev`.
- **Fuentes distintas al render offline**: las plantillas usan Google Fonts;
  sin internet el sistema provee el fallback.

---

## English

### Requirements

- **Node.js 18+** (uses `node:test` and modern fs APIs).
- ~200 MB of disk: Puppeteer downloads its own Chrome/Chromium at install time.
- Network only for two things: `npm install` and the Google Fonts the projects
  link (offline they fall back to system fonts — the layout keeps working).

### Installation (self-host)

```bash
git clone <your-remote> afiche-studio   # or just copy the folder
cd afiche-studio
npm install                             # downloads Chrome for Puppeteer
npm test                                # 27 tests, zero extra deps
```

No special permissions, no required env vars. `outputs/` is the only directory
written outside `projects/` while rendering. Everything stays on your machine:
no account, no cloud, no telemetry.

### Studio mode (recommended)

```bash
npm run dev        # opens http://localhost:4560 in a single tab
```

Live editor:

- **Code:** per-project `index.html` and `styles.css` tabs (autosave after 2 s,
  `Ctrl+S` to force).
- **Preview:** instantly reloaded iframe with chips for every variant
  (`post`, `story`, `thumb`, `banner`, `og`, `wide`) and responsive auto-zoom
  (usable down to ~700 px wide).
- **Export…**: floating panel to render **PNG / WEBP / JPG** variants at
  1x–3x scale. Files land in `outputs/` with download links.
- **+ New**: creates projects from the template. Optionally attach **one or
  more stylesheets** (`.css`, or HTML with `<style>` blocks) — it never asks
  for, or uploads, a folder of your code. No files → plain template.
- **Shareable URL**: `?project=<name>` opens that project directly.

What you save here is exactly what the CLI renders later.

Server environment variables:

| Variable         | Effect                                        |
|------------------|-----------------------------------------------|
| `PORT`           | change the port (default `4560`)              |
| `AFICHE_NO_OPEN` | do not auto-open the browser                  |

### CLI

```bash
node cli/afiche.js --list                    # list projects
node cli/afiche.js --create mi-post          # create from the template
node cli/afiche.js --preview mi-post         # open the HTML in your browser
node cli/afiche.js mi-post                   # render PNG (preset from config)
node cli/afiche.js mi-post --preset story    # another variant
node cli/afiche.js mi-post --preset thumb --scale 3
node cli/afiche.js --all                     # render everything
node cli/afiche.js mi-post --app /path/app   # scaffold from an app's global CSS
```

The CLI's `--app` does walk a local folder (skipping `node_modules`, `dist`,
`build`, `.next`, …), but all of it happens on your machine: it extracts design
tokens (`:root` colors, fonts, `border-radius`) and generates a generic poster
you can edit and export. It is a heuristic — a starting point, not a clone.

### How to design

1. Every project is a folder in `projects/` with `index.html` + `styles.css`
   + `config.json`. The canvas is the `#canvas` element.
2. Text lives in the HTML; the design lives in `styles.css` (linked after
   `shared/styles/brand.css` and `adaptive.css`).
3. Brand colors: variables in `shared/styles/brand.css` — edit once, every
   project updates.
4. `shared/styles/adaptive.css` + `shared/scripts/adaptive.js` expose
   `--W / --H / --S` and `data-orient` for the forced variant, so one design
   serves every format.
5. Iterate in the studio, export with `node cli/afiche.js mi-post`.

### Presets

| Preset   | Size         | Use                    |
|----------|--------------|------------------------|
| `post`   | 1080 x 1080  | Instagram / Facebook   |
| `story`  | 1080 x 1920  | Stories / Reels        |
| `thumb`  | 1280 x 720   | YouTube thumbnail      |
| `banner` | 1500 x 500   | X / LinkedIn           |
| `og`     | 1200 x 630   | Open Graph (links)     |

Renders apply `deviceScaleFactor` (2 by default): a `post` comes out at
2160 x 2160 px — sharp for retina and zoom.

### Per-project configuration (`config.json`)

```json
{
  "name": "mi-post",
  "title": "My Promotional Post",
  "preset": "post",
  "width": 1080,
  "height": 1080,
  "scale": 2,
  "outputFormat": "png",
  "brand": { "colors": { "accent": "#d4af37" } }
}
```

`width`/`height` only matter for custom dimensions; table presets take
precedence over them, and the `--width/--height` flags override everything.

### Structure

```
afiche-studio/
├── src/                        # Core: business logic (no HTTP, no argv)
│   ├── presets.js              # PRESETS + defaults (single source of truth)
│   ├── config.js               # Paths and port
│   ├── projects/               # registry (list/read/paths) + creator (templates/)
│   ├── render/                 # browser.js (Puppeteer singleton) + renderer.js
│   └── scaffold/               # scan.js + generate.js + index.js (tokens → poster)
├── cli/afiche.js               # Commander only: maps flags → src/
├── server/
│   ├── index.js                # HTTP bootstrap (route wiring)
│   ├── http-utils.js           # send / readBody / safeJoin / MIME
│   ├── routes/                 # api.js · static.js · sse.js (live reload)
│   └── public/                 # Editor (vanilla ES modules)
│       ├── index.html · editor.css · editor.js · editor-highlight.js
│       └── components/         # store · api · status · router · menu · shortcuts ·
│                               # projects · toolbar · code-editor · code-tabs ·
│                               # preview · export-panel · new-project
├── shared/                     # Canvas browser runtime (brand.css, adaptive.*)
├── templates/                  # Base template (index.html + styles.css + config.json)
├── projects/                   # Your designs (index.html + styles.css + config.json)
├── outputs/                    # Generated renders (gitignored)
└── tests/                      # node:test, zero dependencies
```

### Troubleshooting

- **Puppeteer can't find Chrome** (restricted network): `npx puppeteer browsers install chrome`.
- **Browser didn't open automatically**: visit `http://localhost:4560` manually,
  or run with `AFICHE_NO_OPEN=1`.
- **Port taken**: `PORT=4570 npm run dev`.
- **Fonts differ in offline renders**: templates link Google Fonts; without
  internet the system provides the fallback.

## Differences with hyper-frames-videos

|                  | videos                    | images (this one)          |
|------------------|---------------------------|----------------------------|
| Output           | MP4/WebM frame by frame   | Single high-res PNG        |
| Animation        | GSAP timeline             | Static (pure CSS)          |
| Typical use      | demos and motion promos   | posts, thumbnails, banners |
