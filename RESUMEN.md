# RESUMEN — refactor del studio + extracción de CSS

Fecha: 2026-09-12 · Sin commits · `npm run test`: **27/27 en verde**

## 1. Extracción de CSS (T1)

Cada `projects/<n>/index.html` y `templates/index.html` tenía un `<style>` inline
gigante. El bloque se copió **byte-exacto** a `styles.css` (solo se agregó un
comentario de cabecera) y se reemplazó por
`<link rel="stylesheet" href="./styles.css">`, junto a los links existentes de
`brand.css` y `adaptive.css`.

**Archivos creados (7):**

- `projects/afiche/styles.css`
- `projects/afiche-studio/styles.css`
- `projects/demo/styles.css`
- `projects/git-hero/styles.css`
- `projects/nodovec/styles.css`
- `projects/vitrina/styles.css`
- `templates/styles.css`

**Archivos modificados:** los 7 `index.html` correspondientes (solo el bloque
`<style>` → `<link>`).

**Scaffold:** `creator.create()` ya copia `templates/` recursivamente
(`fs.cpSync`), así que `styles.css` viaja solo a cada proyecto nuevo. No fue
necesario tocar `src/scaffold` (prohibido). Nota: los proyectos generados por
`--app`/scaffold con tokens sobrescriben `index.html` con su propio `<style>`
inline (comportamiento preexistente, intacto); el `styles.css` de la plantilla
les queda huérfano e inofensivo.

**Resolución del link relativo — verificada, sin cambios de motor:**

- CLI/server render: `renderer.js` usa `page.goto('file:///…')` (no
  `setContent`), así que `./styles.css` resuelve contra el filesystem. ✔
- Preview del studio: el iframe carga `/proj/<n>/index.html` y
  `server/routes/static.js` sirve cualquier archivo del directorio del
  proyecto → `/proj/<n>/styles.css` responde 200 `text/css`. ✔
- Se agregó `Cache-Control: no-store` en `server/http-utils.js` `send()` para
  que el iframe no vea un `styles.css` viejo tras cada autosave.

**API de edición:** `GET/PUT /api/project/<name>` ahora acepta `?file=` con
allow-list `index.html | styles.css` (`server/routes/api.js`); sin parámetro el
comportamiento es idéntico al anterior (`config.json` y cualquier otro nombre
responden 404).

## 2. Frontend ordenado (T2)

`editor.js` (140 líneas monolíticas) se dividió siguiendo el patrón factory de
`components/`. **Todos los archivos ≤ ~120 líneas, un solo responsable, cero
lógica de estilos en JS (solo clases y números en custom properties).**

Nuevos componentes (`server/public/components/`):

| Archivo | Responsabilidad | Líneas |
|---|---|---|
| `store.js` | estado compartido + suscripción | 24 |
| `api.js` | wrapper fetch (json/text, url de projectFile) | 28 |
| `status.js` | línea de estado `#status` | 18 |
| `router.js` | `?project=` en la URL (estado/ruteo) | 27 |
| `menu.js` | colapso del toolbar (clase `open` en header) | 23 |
| `shortcuts.js` | Ctrl+S / Ctrl+E / Escape | 25 |
| `projects.js` | casos de uso open/create | 63 |
| `code-tabs.js` | selector de archivo index.html ↔ styles.css | 36 |

Reescritos: `editor.js` (73, solo bootstrap), `code-editor.js` (122, drawer +
buffers + autosave), `toolbar.js`, `preview.js` (mide el área disponible con
`ResizeObserver`; el zoom/tamaño se publican como `--z/--pw/--ph` y la fórmula
vive en CSS), `export-panel.js` (links escapados, sin estilos inline).
`new-project.js` y `editor-highlight.js` sin cambios.

## 3. Responsive y estética (T3)

`server/public/editor.css` reescrito; `index.html` del studio ahora carga
`/shared/styles/brand.css` y **usa solo sus tokens de paleta** (`--bg`,
`--surface`, `--line`, `--text`, `--muted`, `--accent`, `--accent-dim`,
`--accent-hover`, `--success`, `--error`). Las variables nuevas de editor.css
son de layout: escala de espaciado (`--sp-1..5`), radios (`--radius-sm/-/-lg`) y
colores de syntax highlighting (no son paleta de marca).

- **≤900px:** el drawer de código pasa de panel lateral a *bottom sheet*
  apilado (el preview se achica y el auto-fit lo reescala); se oculta el rail
  vertical y las dimensiones de los chips.
- **≤700px:** toolbar colapsable con botón ☰ (`menu.js` solo alterna una
  clase); los controles extra (`+ New`, `Code`, `Save`, estado) pasan a una
  segunda fila; chips con ellipsis; export panel con ancho limitado al viewport.
- Auto-zoom del preview a cualquier ancho (medido, no hardcodeado).
- Estados `:focus-visible` con anillo de marca en todos los controles, hovers
  uniformes, `prefers-reduced-motion` respetado.
- Capturas verificadas en headless a 1280 / 900 / 700 px.

## 4. Revisión (T4)

`npx --yes react-doctor .` corre también sobre vanilla JS: pasó de **8 a 7
warnings**. Corregidos: `await`-en-loop de `loadAll` (ahora `Promise.all`),
sink HTML sin escapar en `export-panel` (ahora `esc()`), estilos inline fuera
de JS/HTML. Descartados con criterio: `api.js:9` (falso positivo — ambas ramas
revisan `r.ok`), `code-tabs.js:14` (innerHTML desde constante), los 3
await-in-loop restantes son secuenciales a propósito (PUTs de 2 archivos,
lectura de picker, renders con un solo browser puppeteer) y `server/index.js:31`
(es el wrapper local para abrir el navegador, preexistente).

Revisión manual: ningún componente >122 líneas; ningún `style=` inline en JS;
los selectores `#canvas` repetidos en los 6 `styles.css` son **por diseño** (cada
afiche es autocontenido; la base común ya vive en `brand.css`/`adaptive.css`) —
no se fusionaron para no arriesgar el pipeline de variantes.

## 5. Nuevo proyecto menos invasivo (pedido posterior)

Se eliminó la opción de subir la **carpeta completa** de la app (input
`webkitdirectory` y botón "Folder…"): la persona ya no comparte su código,
solo uno o varios archivos de estilos.

- `server/public/index.html`: un único botón "CSS files…" con
  `<input type="file" multiple accept=".css,.htm,.html">`.
- `server/public/components/new-project.js` (90 líneas): validación en cliente
  — extensión, tamaño (≤200 KB, en sync con el scanner), tope de 24 archivos,
  lecturas fallidas; los archivos inválidos se **saltan con aviso** en el
  label ("N styles ready · M skipped: not css/html or >200kb").
- Fallbacks: sin archivos o todos rechazados → plantilla simple (`/api/create`);
  con archivos válidos → `/api/scaffold`. Estados visuales nuevos `.warn` /
  `.empty` en `editor.css` (tokens de marca).
- El `appPath` del scaffold server-side (CLI `--app`) sigue intacto; solo se
  quitó el picker de carpeta del navegador.
- Verificado headless: subir `theme.css + notes.txt + huge.css` → "1 style
  ready · 2 skipped", scaffold con accent detectado (#22cc88), y create sin
  archivos → "opened: …". `npm run test` 27/27.

## 6. README bilingüe para self-host (pedido posterior)

`README.md` reescrito en **español + inglés**, documentando el build local:
requisitos (Node 18+, descarga de Chrome por Puppeteer, qué necesita red),
instalación, `npm test`, modo studio (tabs index.html/styles.css, `?project=`
en URL, +New solo con archivos de estilos), env vars `PORT` / `AFICHE_NO_OPEN`,
CLI, presets, estructura actualizada y troubleshooting. También:
`server/index.js` ahora abre el navegador correctamente en Windows/macOS/Linux
(antes usaba `cmd /c start` en cualquier plataforma; el wrapper personal sigue
teniendo prioridad si existe). Verificado: `PORT=4571` + `AFICHE_NO_OPEN=1` →
`/api/meta` 200; tests 27/27.

## Qué cambió en el render de los proyectos

**Nada.** Los 6 proyectos renderizan **byte-idénticos** (SHA-256) antes vs
después, verificado con `--scale 1`:
`afiche, afiche-studio, demo, git-hero, nodovec` (master) y
`vitrina --preset post` (el CLI usa `--preset`, no existe `--variant`).

Detalle importante: durante la revisión se detectó un bug preexistente en
`shared/scripts/adaptive.js` (línea 32: `e.getBoundingClientRect()` debería ser
`el`). Arreglarlo hace que el `ResizeObserver` finalmente se instale y
`--W/--H/--S` se actualicen al forzar variantes — **eso cambia el output de 4
proyectos**. Como la restricción exige pipeline idéntico, se **revirtió** y se
documenta como hallazgo. El error solo lanza un `ReferenceError` en la consola
del iframe y deja `data-overflow` sin asignar (no lo usa ningún CSS).

## Pendientes

- Fix del bug de `adaptive.js` (`e`→`el`): requiere re-baseline visual de los 4
  proyectos afectados (probablemente mejore variantes no-1080, pero cambia el
  output actual). Decisión abierta.
- Los proyectos generados por scaffold (`--app`) siguen con `<style>` inline
  (vive en `src/scaffold/generate.js`, zona prohibida); migrarlos a
  `styles.css` sería un cambio de una línea allí más adelante.
- `react-doctor`: el warning del bridge localhost en `server/index.js` queda
  (es herramienta de desarrollo del autor).
- La paleta del editor quedó 100% en tokens de `brand.css`; si se quiere tema
  claro/dark toggle, falta definir tokens de tema en `brand.css` (no tocado a
  propósito por ser compartido con los proyectos).
