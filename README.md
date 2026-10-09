# DS Universe

**Explore a Figma design system as a living graph, from a single component to the whole library.**

DS Universe reads a Figma library (components, variants, variables and the screens that use them) and lets designers and developers travel through it on four levels:

| Level | What you see |
| --- | --- |
| **Library** | Every component, grouped by layer and family, with their "contains" relations |
| **Usage** | Where the component lives: patterns and screens that use it |
| **Pattern** | The parent components that instantiate it, with their layout tokens |
| **Component** | The component itself: click a zone (padding, radius, color…) to see the Figma variable, its alias chain, the resolved value and the generated CSS |

It also ships a **Builder** (compose screens from real components, Stacks and logic nodes, and export JSX + CSS tokens) and a **Tokens** view (collections, modes and an audit of unbound values).

The demo library is Figma's [Simple Design System](https://github.com/figma/sds) (MIT).

## Quick start

```bash
git clone <this repo>
cd app
npm install
npm run dev          # http://localhost:5173, opens on the demo library
```

Requirements: Node 20+.

## Use your own library

1. **Scan** your Figma file into a `library.json` (see [Scanning](#scanning)). Start with **one component** to try it out, then scan a page, then the whole file.
2. In the app, click **Import…** and pick the file. Nothing leaves your browser.

### Scanning

The Figma REST API only exposes variables to Enterprise plans, so the scan runs **inside Figma** with the Plugin API, which works on every plan. The scanner plugin lives in `plugin/` (instructions in its README).

### Live previews (optional)

Screens and components without a render tree can be shown as PNGs rendered by Figma. This needs a personal access token with read access to file content:

1. Figma → Settings → Security → Personal access tokens.
2. Copy `app/.env.example` to `app/.env` and set `FIGMA_TOKEN=`.

The token is only read by the dev server proxy and never sent to the browser. You can also paste a token in the **Figma** button of the app: it is kept in your browser's `localStorage` and only sent to Figma.

## Scripts (from `app/`)

```bash
npm run dev            # development
npm run build          # production build in dist/
npx tsc -b && npx oxlint
node e2e/run-all.mjs   # Playwright regression suite (against `npx vite preview --port 4175`)
```

More details on features and architecture: [`app/README.md`](app/README.md).

## Credits

- Demo data: [Simple Design System](https://github.com/figma/sds) by Figma, MIT.
- Fonts: [Inter](https://github.com/rsms/inter), [Onest](https://github.com/simpals/onest) and [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), SIL Open Font License 1.1 (licenses in `app/public/fonts`).
- Music and sound effects of the original sound design: [Epidemic Sound](https://www.epidemicsound.com) (licensed, not included in this repository; see `app/public/audio/README.md` to add your own).
- Created by Romain DAO, [The Cacatoès Theory](https://www.thecacatoestheory.com/).

## License

[MIT](LICENSE)
