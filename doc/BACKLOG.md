# Backlog

Everything open, itemised. **Every entry names a file** — an item nobody can
locate is not an item.

Nothing here is scheduled. [ROADMAP.md](ROADMAP.md) is where things get an
order; this is the pool they are ordered from.

Last reviewed: 2026-08-26.

Size: **S** under an hour · **M** an afternoon · **L** a day or more · **?** needs
a decision before it can be sized.

---

## Blocking a merge

### B1 · The `strip` and `etch` panels are on a branch, unmerged · S
`onepage-strip-panel`, two commits ahead of `main`, pushed, no pull request
opened. Both panels are verified against a real browser and deployed to a
preview, but `main` does not have them.

### B2 · Three design-sync previews carry placeholder gibberish · S
Uncommitted edits in
`packages/onepage-chrome/.design-sync/previews/{Loader,OnepageRoot,Panel}.tsx`
replace real copy with `"One ccbx Page"`, `"saleti"` and `"Saleti!"`. They look
like leftovers from a round-trip test.

This contradicts the package's own rule, in `.design-sync/NOTES.md`: *"Canonical
usage lives in the repo root's `index.html` — every authored preview's copy and
composition is ported from it verbatim."*

Either revert them to the `index.html` copy, or keep them and say why in NOTES.

### B3 · Loose working-tree state · S
- `.gitignore` has an uncommitted `.env*` line — good change, never committed.
- `.vite/` is untracked and *not* ignored, so it is offered on every `git status`
  and would be uploaded by a CLI deploy.

---

## Correctness and hygiene

### B4 · `original.html` phones home to tympanus.net, and it ships · M
```html
<script src="//tympanus.net/codrops/adpacks/analytics.js"></script>
<script src="https://tympanus.net/codrops/adpacks/cda_sponsor.js"></script>
```
It is registered as a build input in `vite.config.ts`, so every deployment
serves a page that loads third-party analytics and an ad script — from a
protocol-relative URL, at that.

Options: strip the two tags, drop the page from the build inputs and keep it as
a source-only reference, or move it out of `public` reach. **Needs a decision on
whether the original demo needs to be reachable at a URL at all.**

### B5 · Two dependencies belong only to the original demo · S
`motion` and `troika-three-text` are reached only from
`src/js/classes/WebGLText.ts`, which the one-pager never imports. If B4 removes
the original from the build, both can leave `package.json`.

### B6 · `config.html` 404s on `/favicon.ico` · S
It has no `<link rel="icon">`, so the browser asks for the default and gets a
404 on every load. Cosmetic, one line. `index.html` already links `/vite.svg`.

### B7 · Letters in flight can cross the pale gaps and vanish · S
`EtchedLines` throws each letter in from a random point, and its path can run
across the pale band between two black ones — where a white hairline on a pale
ground is invisible. Brief and half-faded, so it reads as flicker rather than as
a bug, but it is one.

Fix is either clamping the throw to the letter's own band, or fading harder
outside it. `TUNE.etch.throw` controls the distance today.

### B8 · Nothing detects copy drift into the design-sync previews · M
From `.design-sync/NOTES.md`: *"Preview copy is a hard-coded snapshot of
`index.html`. If the demo's page copy changes, the cards keep showing the old
strings; nothing detects the drift."* B2 is this problem having already happened
once.

### B9 · `HintAtPeak` is duplicated across five previews · S
`PanelHint.tsx`, `Panel.tsx`, `VisuallyHidden.tsx`, `OnepageRoot.tsx`,
`Loader.tsx` each carry their own copy of the helper that freezes
`.panel__hint`'s infinite animation for a still capture. Rename or remove that
animation upstream and the helper goes stale in five places at once, while the
previews keep working and the reason for them evaporates.

---

## Accessibility and reach

### B10 · `prefers-reduced-motion` is honoured by one label · M→L
`src/css/onepage.css` has exactly one reduced-motion rule, and it disables the
tearing animation on `.sphere__label`. The entire scroll-driven WebGL story —
twenty-one screens of pointer-reactive, velocity-driven, physics-simulated
movement — ignores the preference completely.

The honest minimum is a static readable fallback. **Needs a decision on what
"reduced" means for a page whose whole content is motion.**

### B11 · No no-WebGL fallback · M
The page needs WebGL and says so in the README, but the page itself does not
check. Without it the reader gets the hidden copy and a blank canvas. The copy
is all in the DOM already, so a fallback that simply reveals it is mostly a
stylesheet.

### B12 · Desktop and pointer only · L
The banner reacts to the pointer, the sphere wants a click, and nothing has been
tried on touch. No viewport breakpoints exist for the scene. Currently
undocumented as a limitation anywhere except one line in the root README.

### B13 · No performance budget · ?
Every character in the paragraphs is its own mesh, and while falling also its own
physics body. `EtchedLines` adds one `LineSegments` and one material per letter
across six lines. Nothing has been profiled, and there is no number anyone is
holding to. Frame timings on a mid-range laptop and a phone would at least turn
this from a worry into a fact.

---

## Tooling

### B14 · No linter, no formatter, no CI · M
`tsc` is the only automated check, and it runs only when someone types `npm run
build`. A push cannot fail. Given there are no tests either (B15), a GitHub
Action running `tsc` on every push is the cheapest real safety net available.

### B15 · No tests · ?
Legitimately hard for a page whose output is pixels, and the codebase is honest
about preferring "open the page once" over a test in several places. But some
things are testable without a renderer: `Director`'s phase arithmetic,
`Typography.layout()`'s wrapping and advance widths, `copy-writer`'s rewrite of
`index.html`, the `TUNE`/`tune-schema` cross-check for dead knob paths.

**Needs a decision on where the line is.**

### B16 · The knob/schema mismatch check is manual · S
A `TUNE` value with no `tune-schema.ts` entry is invisible in the config panel; a
schema entry whose `path` no longer resolves shows a dead row. The file's own
comment says this is caught "by looking at the panel once". A dozen-line script
walking both would catch it without anyone looking.

### B17 · `dist/styles.css` staleness can ship silently · S
From `.design-sync/NOTES.md`: `cssEntry` points at a build artifact, and if
`npm run build` is not re-run before the converter, token or class changes fail
to ship with no error. Worth a guard in the sync script rather than a note.

---

## Content

### B18 · Every word on the page is lorem ipsum · ?
Placeholder throughout: banner, paragraphs, core line, the second level's eight
words, the six lines in the bands. Fine while the mechanics are being built,
and the thing standing between this and being shown to anyone.

Tied to the template question — see [ROADMAP.md](ROADMAP.md), theme 1.

### B19 · Copy budgets are tuned to the lorem, not documented as a shape · S
`config.html` reports a character budget per block and refuses to apply copy
outside it. The numbers are real constraints (mesh count, physics bodies,
layout), but they are expressed only as a range in the panel. What actually
breaks past the top of the range is not written down anywhere.
