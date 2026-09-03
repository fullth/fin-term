# design-sync notes — fin-term Web UI

## Shape

- This repo is a **private Vite app** (`web/client`), not a published component library. No `dist/` with exports, no `.d.ts` tree, no Storybook.
- Synced via a **hand-written synthetic entry**: `web/client/.ds-entry.tsx` re-exports the 9 presentational components. Passed to the converter with `--entry web/client/.ds-entry.tsx`. This file is committed (a re-sync needs it) but is NOT imported by the app build.
- `PKG_DIR` resolves to `web/client` (the nearest `package.json` with a `name`: `fin-term-client`). So `cfg.cssEntry`, `cfg.tsconfig`, and `cfg.componentSrcMap` values are all **relative to `web/client/`**, not the repo root. `cfg.entry` is the exception — cwd-relative (repo root).

## Scoped components (9)

Only clean, prop-only presentational components are synced:
Sparkline, QuotePanel, Watchlist, NewsStream, IndicesPanel, MarketsPanel, HotPanel, BriefPanel, AlertTriggerButton.

**Deliberately excluded** and why:
- `SearchBar`, `CoinSearchBar` — call `api.*` (backend BFF) on keystroke.
- `AlertButton`, `AlertSettingsModal` — modal + large stateful prop surface.
- `InstallButton` — render output depends on browser `beforeinstallprompt` / iOS detection; renders `null` in most contexts.
- `AiKeyManager`, `AiPanels` (`ExplainPanel`), `ManualModal` — stateful / API-bound / overlay.
- Screen containers: `TerminalView` (33KB), `DiaryView` (19KB), `ExcelView`, `CryptoView`, `MarketTimeline` — full app screens, not reusable parts; each takes ~15 props of live data.

To add one later: add its export to `web/client/.ds-entry.tsx`, a `cfg.componentSrcMap` pin, a `cfg.dtsPropsFor` body, and a `.design-sync/previews/<Name>.tsx`.

## Props (`cfg.dtsPropsFor`)

The converter's ts-morph pass only reads `**/*.d.ts` + the entry — it does **not** parse `.tsx` source, and the components declare `interface Props` (not `interface <Name>Props`). So auto-extraction yields empty props. Every component's prop interface is **hand-written in `cfg.dtsPropsFor`**, transcribed from the component source + `web/client/src/lib/types.ts`.
**Re-sync risk:** if a component's real props change, `dtsPropsFor` won't notice — the emitted `.d.ts` will be stale. On re-sync, diff each scoped component's source `interface Props` against its `dtsPropsFor` entry.

## CSS / tokens

- One monolithic stylesheet: `web/client/src/styles/app.css` (~840 lines) — tokens in `:root` + all component styles. `cfg.cssEntry` points at it; it ships as `_ds_bundle.css` and is `@import`ed from `styles.css`.
- Design language: Bloomberg-terminal dark. `--bg #0a0b0d`, panels `--panel`, monospace (`--mono`). **Korean market convention: up = red (`--up #f43f5e`), down = blue (`--down #3b82f6`)** — not the Western green/red.
- No component-scoped CSS, no CSS Modules. Components attach classnames (`.panel`, `.mode-btn`, `.ptitle`, `.t-yellow`, `.listrow`, `.up`/`.down`/`.dim`, ...) and all styling lives in `app.css`.

## Known render warns

- `[FONT_MISSING] "JetBrains Mono"` — **accepted substitute.** `--mono` is a fallback stack: `"SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace`. The app never ships or loads JetBrains Mono; it relies on the OS mono font (SF Mono on macOS, Consolas on Windows). System-mono is the intended rendering. Do not add `cfg.extraFonts` for it. Re-syncs: this warn is expected, not new.

## Re-sync risks

- `web/client/.ds-entry.tsx` and `cfg.dtsPropsFor` are hand-maintained mirrors of app source — they drift silently. Re-verify props on every re-sync.
- Preview mock data (`.design-sync/previews/*.tsx`) is invented, not from repo fixtures (the app has none). If the domain types in `web/client/src/lib/types.ts` change shape, the mocks may no longer typecheck — rebuild will surface it as a preview compile failure.
- The app build assumes Node >=18, npm (package-lock). Converter deps live in the gitignored `.ds-sync/` — a fresh clone must re-run `npm i esbuild ts-morph @types/react playwright` there + `npx playwright install chromium`.
- No `cfg.buildCmd` — the app itself doesn't need building for the sync (the synth entry is bundled directly from `.tsx` source by esbuild).
