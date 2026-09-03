# fin-term Web UI — conventions

A Bloomberg-terminal-style finance dashboard. Dark, dense, monospace. This is a
**class-based** system: components carry classnames and every style lives in one
stylesheet (`_ds/<folder>/styles.css`, which imports `_ds_bundle.css`). There is
no CSS-in-JS, no CSS Modules, no utility framework. To style your own layout glue
around these components, **reuse the class vocabulary below** — do not invent new
class names, and do not reach for Tailwind/inline-style systems.

## Setup

No provider or theme wrapper. Components render correctly as long as
`styles.css` is loaded — it defines the `:root` tokens and every component class.
Mount components directly; pass the props in each `<Name>.d.ts`.

Root background is near-black (`--bg: #0a0b0d`). Put components on a matching
dark surface or they will look stranded — wrap sections in `<div className="panel">`.

## Color language — read this before styling anything

**Korean market convention: up = red, down = blue.** This is deliberate and
opposite the Western green/red.

| Token | Value | Meaning |
|---|---|---|
| `--up` | `#f43f5e` (red) | price gain, positive change |
| `--down` | `#3b82f6` (blue) | price loss, negative change |
| `--dim` | `#6b7280` | zero change, muted/secondary text |
| `--txt` | `#d7dbe0` | body text |
| `--bg` / `--panel` | `#0a0b0d` / `#0b0d12` | page / panel background |
| `--border` | `#2a2f37` | panel and row borders |
| `--yellow` `--cyan` `--blue` `--magenta` `--red` `--green` | accent hues | panel titles, tags, status |
| `--mono` | `"SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace` | the only font family — everything is monospace |
| `--radius-sm` / `--radius-md` | `5px` / `8px` | button / panel corner radius |

The helper `changeClass(n)` in the app returns `'up' | 'down' | 'dim'` — apply
that class to any number that represents a delta.

## Class vocabulary

**Containers**
- `.panel` — the primary surface: 1px `--border`, `--radius-md`, `--panel` bg, `8px 12px` padding. Add `.focused` for a cyan border.
- `.app-shell` — full-height flex column page shell (topbar + body + cmdbar).
- `.topbar` — the top navigation bar strip.
- `.col-left` / `.col-mid` / `.col-right` — the 3-column stock-mode layout.

**Panel titles**
- `.ptitle` — panel heading row (bold, 6px bottom margin, flex). Combine with a hue: `.t-yellow` `.t-blue` `.t-magenta` `.t-red`.
- `.ptitle .sub` — dimmed secondary text inside a title (e.g. a count `[6]`).

**Buttons**
- `.mode-btn` — the standard button: transparent bg, 1px `--dim2` border, `--radius-sm`, 12px mono. `:hover` turns cyan. Add `.active` for the green "selected" state.
- `.alert-trigger` — red-outlined variant for the alert toggle; `.on` adds a filled ring.
- `.nav-sep` — a `│` divider between button groups. `.nav-live` — the green `● live` indicator.

**List rows**
- `.listrow` — a clickable watchlist row; `.sel` marks the selected one (cyan left bar). `.listrow-top` / `.listrow-sub` are the two lines. `.caret` is the `▶` marker.
- `.news-row` — a headline row: `.num` `.time` `.tag` (`.tkr` cyan / `.mkt` dim) `.title` `.src`.
- `.hot-row` — a mover row with `.hot-main`, `.hot-meta` (`.hot-sector` `.hot-vol`), and nested `.hot-news` list. `.hot-mkt` is the market chip (`.mkt-kr` blue / `.mkt-us` green).
- `.row` — a generic label/value row used in the index & FX panels.

**Value formatting**
- `.val` — a right-aligned numeric cell; combine with `.up` / `.down` / `.dim`.
- `.sym` — a ticker symbol (bold). `.name` — a company name (dimmed).
- `.field` / `.fields` — the OHLC key/value grid in QuotePanel; `.l` is the label.
- `.spark` — the inline SVG sparkline element.
- `.halt-badge` — a red "⛔ 정지" pill for halted symbols.
- `.dim` — apply to any de-emphasized text or empty-state message.

## Where the truth lives

- **`_ds/<folder>/styles.css`** and its `@import`ed `_ds_bundle.css` — the full class + token source. Read it before styling.
- **`components/general/<Name>/<Name>.prompt.md`** — per-component prop reference and composition notes.

## Idiomatic build snippet

```tsx
import { QuotePanel, Sparkline } from 'fin-term-client';

// Layout glue uses the DS classes, not a utility framework.
function DetailColumn({ quote, detail }) {
  return (
    <div className="col-mid">
      <QuotePanel quote={quote} detail={detail} />
      <div className="panel">
        <div className="ptitle t-yellow">SPARK</div>
        <Sparkline values={quote.spark} positive={(quote.change_pct ?? 0) >= 0} />
      </div>
    </div>
  );
}
```

Note `positive` on `Sparkline` follows the Korean convention: `true` (a gain)
draws the `--up` red stroke, `false` draws the `--down` blue.
