# onepage-chrome — conventions

Eight React components lifted from a scroll-driven WebGL one-pager: near-black
ground, bone text, monospace, uppercase, wide tracking. Everything is on
`window.OnepageChrome`.

## Wrap everything in OnepageRoot

`OnepageRoot` carries the whole design language — `background: var(--clr-bg)`,
`color: var(--clr-text)`, `font-family: var(--font-mono)`, `font-size: 12px`,
`letter-spacing: var(--tracking-body)` and `text-transform: uppercase`. It is a
plain `<div class="op-root">`; **a component mounted outside one falls back to
browser defaults** — black-on-white serif, no tracking, mixed case. There is no
context or theme provider anywhere in this library; this wrapper is the entire
setup.

Two consequences to plan for:

- **All text inside renders UPPERCASE.** Write copy in normal case and let the CSS
  transform it. To opt a run out, set `text-transform: none` on your own element.
- The root sizes to its content. Pass `style={{ minHeight: "100vh" }}` for a
  full-bleed page.

## No utility classes — components first, then tokens

There is no utility class vocabulary to compose with. Every class this DS ships is
owned by a component and applied for you: `.op-root`, `.frame`, `.frame__title`,
`.frame__meta`, `.panel`, `.panel__hint`, `.panel__note`, `.panel__note--end`,
`.hud`, `.hud__phase`, `.hud__value`, `.hud__track`, `.hud__bar`,
`.visually-hidden`, `.loading`. Don't write those names yourself and don't invent
new ones in their namespace.

Style your own layout glue with the custom properties, all global on `:root`:

| Group | Tokens |
|---|---|
| Colour | `--clr-bg` `#08090c`, `--clr-text` `#e9e4d8`, `--clr-accent` `#ff6a3d`, `--clr-muted` (bone at 45%) |
| Type | `--font-mono` (body stack), `--font-display` (Humane, weights 100–900) |
| Tracking | `--tracking-body` `.08em`, `--tracking-title` `.2em`, `--tracking-phase` `.28em`, `--tracking-hint` `.32em` |
| Layout | `--content-width` `75vw`, the centred content column |
| Panel heights | `--panel-hero` `100vh`, `--panel-hold` `240vh`, `--panel-gravity` `220vh`, `--panel-outro` `90vh` |

`var(--clr-accent)` is the only chromatic colour in the system — use it for
emphasis and nothing else.

## Component notes that bite otherwise

- **`Panel` is a scroll-story beat, not a section.** `variant` picks its height
  from the `--panel-*` tokens: `hero` 100vh, `hold` **240vh**, `gravity` **220vh**
  and the only variant anchoring content to the top, `outro` 90vh. For ordinary
  page sections use your own `<section>` with the tokens.
- **`Frame` and `Hud` are `position: fixed` and `pointer-events: none`** — page
  chrome, at most one of each per screen, never containing interactive elements.
  `Frame` renders with `mix-blend-mode: difference`, so it inverts against
  whatever scrolls beneath it.
- **`PanelHint` pulses** (opacity .35 → 1 over 3.2s). Use it for the single
  instruction a screen needs; use `PanelNote` for narration that must stay still
  (`tone="end"` tints it accent for a closing beat).
- **`Loader`** covers the viewport while `active`; unmount it or pass
  `active={false}` when ready.
- **`VisuallyHidden`** is how this design keeps a readable document: put the real
  `<h1>` and body copy in it whenever the visible text is drawn some other way.

## Read the real files

`styles.css` and its `@import` closure — `fonts/fonts.css` and `_ds_bundle.css` —
are authoritative for every class and token above; read them before styling. Each
component ships `<Name>.d.ts` for its props and `<Name>.prompt.md` for usage.

## Idiomatic screen

```jsx
const { OnepageRoot, Frame, Panel, PanelHint, Hud, VisuallyHidden } =
  window.OnepageChrome;

<OnepageRoot style={{ minHeight: "100vh" }}>
  <Frame title="Studio / Index" meta="selected work 2019—2026" />

  <Panel variant="hero">
    <VisuallyHidden as="h1">Studio index</VisuallyHidden>
    <PanelHint>move the cursor · then scroll</PanelHint>
  </Panel>

  {/* Ordinary content: your own element, the DS's tokens. */}
  <section
    style={{
      width: "var(--content-width)",
      margin: "0 auto",
      padding: "12vh 0",
      color: "var(--clr-muted)",
      letterSpacing: "var(--tracking-body)",
    }}
  >
    <p>Sixteen projects, arranged by year.</p>
  </section>

  <Hud phase="index" value={0.35} />
</OnepageRoot>
```
