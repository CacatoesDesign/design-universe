# Browser tests (regression)

Playwright scripts that drive the built app and check each feature (`ok` / `FAIL` per check, plus page errors).

```bash
cd app/e2e && npm install          # playwright-core only, no browser download
cd .. && npm run build && npx vite preview --port 4175 --strictPort   # in another terminal
node e2e/run-all.mjs               # whole suite; or: node e2e/run-all.mjs slots1 logic1
```

Environment variables:
- `CHROMIUM_PATH`: Chromium or Chrome executable. Defaults to the one in Claude Code cloud sessions (`/opt/pw-browsers/…`). On a Mac, for example: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- `E2E_URL`: app address (default `http://localhost:4175`).
- `E2E_SHOTS`: screenshots folder (default `e2e/shots`, ignored by git).

Automated browsers (`navigator.webdriver`) skip the welcome screen; `welcome1` opens it with `?welcome`.

| Script | Covers |
| --- | --- |
| `ui1`, `ui1b`, `ui2`, `ui2b`, `ui3` | single bar, variant bar, depth rail, language and type |
| `im1`, `im1b`, `im1c` | ambient light |
| `im2`, `im2b` | breathing links (hover, pulse) |
| `im3`, `im3b` | dive between levels |
| `check7` to `check11` | Builder: components, Stacks, patterns, code, zoom |
| `dark3` | dark mode |
| `multi1`, `edgesel` | multi-selection, link deselection |
| `logic1`, `logic2` | If / Router / Show and simulator |
| `lazy1` | lazy-loaded views |
| `sds2`, `legend` | SDS library, Library view and legend |
| `slots1` | Figma slots in the Builder |
| `sidebar1` | Explorer sidebar: collapsible pages, filter, search, screens |
| `sound1` | optional sound: hidden without audio files; with them, music per level and interface sounds |
| `import1` | importing a one-component scan from the plugin |
| `welcome1` | welcome screen: opening, import shortcut, closing, remembered |

Some scripts write Builder state to `localStorage` before reloading: they assume the SDS demo library.
