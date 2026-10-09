# DS Universe — app

Front-end app (Vite + React + TypeScript) that turns a Figma library into a navigable graph for design and development teams.

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## What the app does

| View | Role |
| --- | --- |
| **Explorer** | Four zoom levels over every scanned component: **Component** (clickable zones, a callout linked by a connector, code typed on the fly, Properties panel with Mapping / Resolution / Generated CSS), **Pattern** (components that instantiate the current one, with gap and layout tokens), **Usage** (component → Router → patterns and screens that use it), **Library** (full graph of "contains" relations). Keyboard navigation (← → zones, ↑ ↓ levels, Esc) or the wheel to change level. |
| **Sidebar** (Explorer) | Collapsible Figma pages, a filter Components / Compositions / Screens, and search. |
| **Library** (Explorer) | Columns per system layer (Primitives → Compositions, from the library's `layers` field; otherwise by nesting depth), then a sub-column per family (Figma page or section). Family filter at the top; the current component stays visible. At rest only the current component's links show; on hover, those of the hovered node, with a pulse. |
| **Builder** | A node canvas to build a screen (the right panel only appears with a selected node: its properties, bound tokens, links and code; the screen preview and code live in the Screen node's inspector). Drag real library components, link them to **Stacks** (direction, gap, padding, background, radius picked from the tokens), then to a **Screen**. Live preview, JSX, CSS with the full token chain, and the code of the components used. Saved locally in the browser. 3 templates: Navbar · landing, Form · submit, Dashboard · actions. |
| **Patterns** (Builder) | Link components to a Stack, select it, then "Save": the pattern joins the palette. Each instance exposes the variants and texts of its components (props `button1Label`, `button2Variant`…). Saving again under the same name updates every instance; "Detach" gives back editable Stacks and components. Generated code: `patterns/<Name>.tsx` + CSS tokens. Saved per library in the browser, `patterns.json` export / import. |
| **Multi-selection** (Builder) | Dragging on empty canvas draws a rectangle that selects every node it touches. Shift or ⌘/Ctrl + click adds a node, Esc clears. A "N nodes selected · Delete · Clear" bar appears, and Delete / ⌫ removes the selection with its links. To pan: hold Space + drag, middle button, two fingers on a trackpad, or the wheel. |
| **Display logic** (Builder) | Three logic nodes in the sidebar's "Logic" section. **If** has two inputs, then and else. **Router** has one input per value, plus default. **Show / Hide** has one input, shown when the condition is true. A condition tests a **state variable** (boolean, enum or number, created in the "Simulate" panel), the **breakpoint** (Desktop ≥ 1280, Tablet ≥ 768, Mobile) or a **Figma collection mode**. The "Simulate" panel changes these values: the preview follows live, the displayed branch is marked "shown" and links of other branches fade. The breakpoint follows the Screen node's width. In generated code, variables and modes become typed screen props (`isLoggedIn = false`, `themeMode = 'Light'`), the breakpoint goes through a `hooks/useBreakpoint.ts` hook, and conditions become ternaries or `&&`. A handle accepts a single link. A pattern can't contain a logic node: put the condition above the pattern. |
| **Slots** (Builder) | Native Figma slots (SLOT props) become inputs of the component node (`▢ Slot`, `▢ Body2`…). Link as many nodes as you like: they replace the slot's Figma content, in canvas order (top → bottom). Without links, the slot keeps the main component's default content. **Empty slot in Figma**: the inspector first offers the **preferred instances** declared in Figma; if there are none, it asks you to **pick the components** to offer for that slot (search among scanned components). That choice is remembered per slot and per library in the browser, and each picked component is added in one click, already linked. In generated code, each slot is a `ReactNode` prop of the component (`slot?: ReactNode`, Figma default content otherwise) and the screen passes its content as a fragment (`<CardSlot slot={<>…</>} />`). Patterns also save their slots' content. |
| **Zoom** | Accessible zoom controls (labelled buttons, announced level) on the Builder canvas, the Usage / Library graphs and the Component view. In the Builder (up to 300 %): pinch or ⌘/Ctrl + wheel to zoom, two fingers or the wheel to pan. In the Component view: pinch or Ctrl/⌘ + wheel centred on the cursor (25 % to 800 %; the wheel alone changes level) and drag to pan. Shortcuts `+` `−` `0` (fit) `1` (100 %). |
| **Camera** | On the first click on a node (or zone) of a view, the camera moves slightly towards it (×1.08, 15 % slide towards the centre, ~0.5 s); it eases back on deselection (click on empty space, Esc, closing the panel). Builder, Component, Pattern, Usage and Library. Off when "reduce motion" is on. |
| **Panels** | Docked to the edge by default, or floating above the canvas: `⇧⌘L` (`Ctrl+Shift+L` outside Mac) or the button in each panel header. Preference kept in the browser. |
| **Language and type** | English interface. Onest for reading, JetBrains Mono only for what you copy (tokens, values, code). Relations as linked sentences, dot progress, Builder's "Clear canvas…" in the ⋯ menu with a confirmation. |
| **Component view** | Breadcrumb, zone picker (`03 Vertical padding ▾`), modes and Properties in a single bar. At the bottom, centred in the visible part of the stage, the variant bar, collapsed by default (icon + current value per axis): clicking an icon expands that axis only (sliding thumb); clicking elsewhere or Esc collapses it. With the Properties panel open: collapsed, raised by 48 px. Zoom at the top left, under the variant name. Shortcuts behind "?" (button or `?` key). Hints are shown once per browser. |
| **Depth rail** | Vertical 4-step rail (Library, Usage, Pattern, Component) with counters, clickable and synced with the wheel, keyboard and breadcrumb. Usage opens framed on the component and its first contexts, Library centred on the current component, never below 60 %. Beyond 4 contexts, compact rows then "+ N more contexts". |
| **Light** | Aurora gradients under a single warm ambient light that glides towards the selected zone or hovered node in 2.4 s, drifts ±30 px at rest and follows the canvas with parallax (4 px max). Static with reduced motion. |
| **Breathing links** | Nothing moves at rest. On hovering a node (Usage, Library, Builder), its links light up and a single pulse travels child → parent (900 ms); the rest of the graph fades to 40 % and the node lifts by 2 px. In the Builder, selection also triggers the pulse, without fading the canvas. Reduced motion: fade only. |
| **Dive** | Between levels, the leaving level recedes and the arriving one settles. The clicked card (Library, Usage context, pattern instance) grows into the next level's frame; going back, the frame folds back into it. Reduced motion: 150 ms fade. |
| **Sound (optional)** | No audio is shipped: the **Sound** button only appears when `public/audio` holds the expected files (list and formats in `public/audio/README.md`). Four-part music following the Explorer level (bar-aligned loops, crossfade on level change) and interface sounds (zones, variants, tabs, panels, Builder). Off by default, choice kept in the browser. Settings: `src/lib/sound.ts`. |
| **Tokens** | Collections and modes, resolved alias chains, components using each variable, and an **audit**: Figma value ≠ bound token, orphan variables, unbound properties. |
| **Get started** | First-launch welcome: explore the demo, scan your Figma file with the plugin, import the result. Shown once per browser, reopened with **Get started** in the top bar. |

## Where the data comes from

`src/data/library.json` is the demo library: **Simple Design System** (SDS), Figma's reference library ([Community](https://www.figma.com/community/file/1380235722331273046/simple-design-system), [code](https://github.com/figma/sds), MIT). It covers everything from primitives to compositions. It was scanned on 2026-10-07 from a copy of the file, read-only, with the Plugin API:

- **347 variables** in 6 collections: Color Primitives, Color (modes SDS Light / SDS Dark), Typography Primitives, Responsive (Desktop / Mobile / Tablet), Size and Typography.
- **113 published components**, all rendered. Internal components (`_…`, `.…`), which Figma doesn't publish, are left out.
  - **Primitives (82)**: pages Accordion → Tooltip.
  - **Compositions (31)**: pages Forms and Sections.
- **"Contains" relations** between components, and 4 screens from the Composition guide page.
- **Component properties**, including **slots**: 36 SLOT props on 31 components. Their preferred values and descriptions were checked one by one (`scan/sds/slots.json`): **none is set in SDS**. 3 slots are empty in the main component (Card (Slot), Form (Slot), Hero (Slot)); the others have default content, rendered as is.
- **Scanned variants**:
  - up to 12 variants per component, in their default state, for primitives;
  - one variant for the Cards, Forms and Sections compositions;
  - **every state** (Hover, Disabled…) for Button, Icon Button and Button Danger.

Raw files: `scan/sds/*.json`. Plugin API scripts used for the demo: `scan/figma/` (serializer `serialize.js`, `scan-page.js`, `scan-vars.js`, `scan-screens.js`, `scan-icons-page.js`, `scan-states.js` for a targeted rescan of states, merged with `node scan/merge-states.mjs`).

```bash
node scan/build-sds.mjs   # rebuilds src/data/library.json from scan/sds
```

The library is served as a separate JSON file (`library-*.json`, loaded at startup), not inside the JS bundle. The **Import…** button loads any `library.json` in the same format (`schema: 1`).

### Scan your own library

The Figma plugin in `../plugin/` (see `../plugin/README.md`) scans a selection, a page or the whole file and downloads a `library.json` to load with **Import…**. It shares the serializer (`scan/figma/serialize.js`) and the normalization (`scan/normalize.mjs`) with the demo build.

### Live previews from Figma

**Token in `.env` (local development)**: copy `app/.env.example` to `app/.env` (ignored by git) and set `FIGMA_TOKEN=`. The Vite server adds it to `/figma-api` requests: it is never exposed to the browser nor included in the build. Restart `npm run dev` after changing it.

Otherwise the **Figma** button (top bar) accepts a Figma personal access token ([create a token](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)). The app checks it (`GET /v1/me`), then asks Figma for PNG renders of usage screens and of components without a render tree (`GET /v1/images/:file_key`) in the scanned file (`file.key` of the library). These previews show in the Usage and Library levels and in a screen's panel.

- The token stays in the browser's `localStorage` and is only sent to Figma.
- Calls go through `/figma-api` → `api.figma.com`: the Vite proxy in `npm run dev` / `npm run preview` (`vite.config.ts`), and the serverless function `api/figma.js` on Vercel (`vercel.json`). On a deployment, only the token sent by the browser is relayed (never a server token), and only `/v1/me` and `/v1/images/:key`.
- A library scanned without a file key gets no previews and no "Open in Figma" link.
- Without a token, the app falls back to PNGs in `public/previews/` if any, otherwise to the screens' composition.

### Rescanning the demo (maintainers)

The demo was scanned with Claude and the Figma connector (MCP `use_figma`, read-only): Claude runs the `scan/figma/` scripts page by page (`serialize.js` pasted at the top of `scan-page.js`), writes the results to `scan/sds/`, then runs `node scan/build-sds.mjs`. The compact layer format is described in `src/lib/types.ts` (`FNode`). The plugin is the simpler path for everyone else.

## Known limits

- **Partial variants**:
  - For components with a State axis, only default-state variants are scanned on page / file scans, 12 at most (a selection scan takes every variant, up to 48). In the demo, Button, Icon Button and Button Danger have every state.
  - For Cards, Forms and Sections in the demo, a single variant is scanned.
- **Examples**: the SDS Examples page has no screen frames (one section of 12 component sets), so no screen comes from it. Usage screens come from the Composition guide page (4).
- **Orphan references**: some compositions instantiate old versions of `Button` that are no longer on any page. They are attached to the living component with the same name (15 relations). `Icon Button Danger`, with no equivalent, is ignored.
- **Icons**: only icons used in scanned variants are embedded (27 SVGs out of the 1,722 on the Icons page).
- **Icon colour**: SDS icons are stroke-based. Older scans only read fill colour, so each icon showed the colour of its first exported instance. Fixed in `serialize.js` and the renderer (per-instance colour, `ic`); in the demo only Icon Button was rescanned, other icon-bearing components keep the issue until their next scan.
- **Images**: image fills are replaced by a hatched pattern in renders.
- **Font**: SDS uses Inter, bundled with the app (`public/fonts`). A missing Figma font falls back to Onest.
- **Slots**: only slots present in the chosen variant get an input (e.g. `Avatars2` or `Slot 2` don't exist in the default scanned variant). Preferred instances pointing to an unscanned component are ignored.
- **Remote variables**: variables from another library file aren't read by the plugin; scan the file where they are defined.
- **Generated code**: a token-faithful draft, not production code.

## Architecture

```
src/
  lib/types.ts        scan format
  lib/library.ts      alias resolution, token tiers, zones, relation index, audit, libId
  lib/codegen.ts      CSS (:root + token chain) and React component
  lib/slots.ts        slots of a variant, suggestions (preferred instances, else remembered picks)
  lib/sound.ts        music per level and interface sounds (Web Audio), optional
  render/FigmaRender  faithful HTML/CSS render of a Figma tree (auto layout, fill/hug, SVG)
  components/         Aurora and Ambient (background), Connector (gradient + comet), Welcome
  views/explorer/     Component, Pattern, Usage and Library levels, Properties panel, sidebar
  views/builder/      Builder (React Flow) + compose.ts (tree → preview and code) + logic.ts (If / Router / Show)
  views/TokensView    collections and audit
api/figma.js          Vercel function: /figma-api relay for previews
scan/                 demo scan (sds/), shared serializer and normalization
```

Dependencies: React 19, `@xyflow/react` (React Flow) for graphs. Inter, Onest and JetBrains Mono fonts served locally from `public/fonts`.
