# design-sync notes — onepage-chrome

## Layout

- The design system is **`packages/onepage-chrome`**, not the repo root. The root
  package is the Vite/three.js WebGL demo the chrome was lifted out of; it has no
  React components and nothing to sync. Run everything from the package dir, with
  the staged scripts at the repo root: `node ../../.ds-sync/package-build.mjs …`.
- No Storybook anywhere in the repo (`shape: "package"` is pinned in config.json).
- Canonical usage lives in the repo root's **`index.html`** — every authored
  preview's copy and composition is ported from it verbatim. Go there first when
  adding or reworking a preview; don't invent content.

## cssEntry must point at the BUILT stylesheet

`package-build.mjs` copies `cfg.cssEntry` **verbatim and does not resolve
`@import`**. `styles/index.css` is nothing but three `@import` lines, so pointing
`cssEntry` at it produces a `_ds_bundle.css` holding three dead references — zero
tokens, zero `@font-face`, and **every design built on the bundle renders
unstyled**. That is exactly how the first (aborted) sync failed.

The fix, already in place: `build.mjs` has a second esbuild pass that flattens
`styles/index.css` into **`dist/styles.css`** (`loader: {".ttf": "file"}`,
`assetNames: "fonts/[name]"`), and `cfg.cssEntry` points there. If you ever
change the stylesheet layout, keep that pass — and re-check that
`grep -c @import ds-bundle/_ds_bundle.css` is 0 after a build.

## Config gotchas

- **`cfg.tokensGlob` is a no-op without `cfg.tokensPkg`.** `lib/css.mjs`
  `copyTokens()` returns immediately when `tokensPkg` is unset, and the glob is
  resolved against that *package* in `node_modules` — not against the DS package.
  This DS keeps its tokens in its own `styles/tokens.css`, so there is no tokens
  package and `ds-bundle/tokens/` stays empty by design. The tokens still reach
  designs: they are inlined at the top of `_ds_bundle.css`, which `styles.css`
  `@import`s. Don't re-add `tokensGlob` expecting a `tokens/` directory.
- **`cfg.extraFonts: "styles/fonts.css"`** is what copies the 9 Humane `.ttf`
  files into `ds-bundle/fonts/` (plus a generated `fonts/fonts.css` with
  `./Humane-*.ttf` urls, imported from `styles.css`). Without it the faces have
  nowhere to resolve to.
- The build line **`_ds_bundle.css fonts: 0 url(s) rewritten, 9 dead @font-face
  block(s) dropped` is expected, not an error.** `dist/styles.css` carries its own
  copy of the 9 faces; the converter drops them from `_ds_bundle.css` on purpose,
  because a duplicate face declared *after* `fonts/fonts.css` would shadow the
  working copy and silently degrade Humane to a system font.

## Preview geometry — the 100vh trap

The generated preview html sets `body { margin: 0; padding: 24px }`. A component
whose height is `100vh` therefore overflows the capture viewport by 48px, and
anything anchored to its bottom edge falls outside the screenshot. For a `Panel`
(bottom-anchored content, `padding-bottom: 5vh`) the content is visible only when
the declared viewport height `H` satisfies `24 + 0.95H ≤ H`, i.e. **`H ≥ 600`**.

That is why `Panel` and `VisuallyHidden` captured completely blank at viewport
heights of 240 and 220, and render correctly at 620. If a preview containing a
full-height panel comes up empty, this is the first thing to check — it is not a
provider or CSS problem.

## Card modes

- **`Frame`, `Hud`, `Loader` need `cardMode: "single"`.** They are
  `position: fixed` page chrome, so in grid mode every cell's chrome stacks
  against the same viewport edge and the cells overlap into nonsense.
- `Panel` is also `single` (`primaryStory: "Hero"`): in `column` mode the four
  variants sum to roughly 2600px of card at any usable width. All four variants
  are still authored, addressable via `?story=`, and graded.
- Keep composition viewports **≥ 1100px wide**. Below that the centred
  `PanelHint` runs into the left-gutter `Hud`, because both sit in the same
  bottom band and `--content-width: 75vw` no longer separates them.

## PanelHint's animation freezes at its faintest frame

`.panel__hint` breathes `opacity: 0.35 → 1` on an infinite loop. Playwright
**cancels infinite animations to their initial state**, so a still capture always
catches 0.35 — and combined with `--clr-muted` (45% alpha) that is roughly 16%
effective opacity, which reads as an empty card.

Every preview that contains a `PanelHint` therefore renders a small `HintAtPeak`
helper: `<style>{`.panel__hint { animation: none; opacity: 1; }`}</style>`. It
shows the peak of the component's own pulse — the state the eye registers on the
running page. If you add a preview using `PanelHint`, copy that helper in.

## Known render warns

Re-syncs compare validate's warn lines against this list; anything not here is new.

- **`[RENDER_BLANK]` on `Loader`** (`components/general/Loader/Loader.html`,
  4638 B). Benign and confirmed by screenshot: the `Active` story is the loading
  curtain, a near-uniform `--clr-bg` field whose only detail is a 100px
  accent hairline, so it compresses below the 5 KB heuristic. Not a blank render.

## Deliberately bare renders (not failures)

- `Panel` → `Hold` is a bare 240vh band. That beat's three paragraphs live in the
  accessibility tree only while WebGL draws the text, so an empty dark field is
  the correct render. Documented in the export's JSDoc.
- `VisuallyHidden` → `HiddenHeadline` shows only the hint line, with no headline
  above it and no gap where one would be. The missing line *is* the component
  working; the real `<h1>` text is in the DOM (visible in
  `.render-check.json` → `texts`).

## Not verified / skipped

- No interaction or hover states are previewed — nothing in this library is
  interactive (`Frame` and `Hud` are explicitly `pointer-events: none`).
- The `breathe` and `loaderAnim` animations are only ever seen as still frames;
  their motion is untested by this pipeline.

## Re-sync risks

- **`dist/styles.css` is a build artifact.** If `npm run build` is not re-run
  before the converter, `cssEntry` points at a stale flattened stylesheet and
  token or class changes silently fail to ship. Always run `cfg.buildCmd` first.
- **The `HintAtPeak` helper is duplicated** across `PanelHint.tsx`, `Panel.tsx`,
  `VisuallyHidden.tsx`, `OnepageRoot.tsx` and `Loader.tsx`. If `.panel__hint`'s
  animation is renamed or removed upstream, the helper goes stale in five places
  at once and the previews keep working while the reason for them evaporates.
- **Viewport overrides encode the 24px body padding arithmetic** above. A change
  to the preview harness's body padding, or to the `--panel-*` tokens, invalidates
  every viewport in `cfg.overrides` — bottom-anchored content would start
  disappearing again.
- **Preview copy is a hard-coded snapshot of `index.html`.** If the demo's page
  copy changes, the cards keep showing the old strings; nothing detects the drift.
- Playwright 1.62.1 + chromium build 1234 were installed into `.ds-sync/` for this
  run (macOS cache lives at `~/Library/Caches/ms-playwright/`, not `~/.cache/`).
