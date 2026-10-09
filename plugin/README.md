# DS Universe Scanner (Figma plugin)

Reads the Figma library you have open (**read-only**) and downloads a `library.json` that DS Universe can import. It runs inside Figma with the Plugin API, so it works on **every Figma plan**: the REST API only exposes variables to Enterprise plans.

## Install (once)

1. Open the **Figma desktop app** (development plugins can't be imported in the browser).
2. Open your design system file.
3. Menu **Plugins → Development → Import plugin from manifest…** and pick `plugin/manifest.json` from this repo.

## Scan

Run **Plugins → Development → DS Universe Scanner**, then:

1. **Start small.** Select **one component** (a component set, a variant, an instance or a frame that contains components) and click **Scan selection**. All its variants are scanned (up to 48).
2. When that looks right in DS Universe, **Scan this page**, then **Scan all pages**. For whole pages, each component keeps its default state (up to 12 variants) to keep the file light.
3. Click **Download library.json**.
4. In DS Universe (`npm run dev` in `app/`), click **Import…** in the top bar and pick the file.

What is read: local variables and collections (with modes and aliases), components and their properties, a render tree per scanned variant (layout, fills, strokes, radius, text, bound variables), icons used by those variants (from pages whose name contains "icon"), "contains" relations between components, and screens (top-level frames that use library components).

Nothing is written to your file and the plugin makes no network request.

## Live previews

DS Universe can show PNG renders of screens through the Figma API. That needs the file key. The plugin reads it automatically when Figma allows it; otherwise paste the file URL in the plugin before scanning.

## Limits

- Variables from another library file (remote variables) are not read: scan the file where they are defined.
- Very large components are cut at 700 layers per variant.
- Scanning all pages of a big file can take a few minutes.

## Development

`code.js` is generated: edit `plugin/src/scan.js`, `app/scan/figma/serialize.js` (render trees) or `app/scan/normalize.mjs` (scan → `library.json`, shared with the app's demo build), then run:

```bash
cd app && npm install   # once: the build uses rolldown from the app
node ../plugin/build.mjs
```
