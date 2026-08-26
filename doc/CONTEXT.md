# Context

How this repository is put together, and the rules that are not enforced by
anything but which the page falls apart without.

Last reviewed: 2026-08-26.

## What it is

A scroll-driven WebGL one-pager, built on top of the
[codrops WebGL text demo](../README.md#original-demo) and extended well past it.
Roughly 7,000 lines of TypeScript in `src/`, no framework, no runtime
dependencies beyond three.js and two small libraries.

Note the gap between the repository's name and its contents: it is called
`grantig-portfolio-template`, and it is currently **one fixed story with lorem
ipsum in it**, not a template anyone could fill with their own work. Closing
that gap is the first theme in [ROADMAP.md](ROADMAP.md).

## Stack

| | |
| --- | --- |
| Build | Vite 6, TypeScript 5.7 (`npm run build` = `tsc && vite build`) |
| 3D | three.js 0.175 |
| Physics | cannon-es — the falling letters, and only them |
| Scroll | lenis — smoothed scroll and velocity, which drive everything |
| Shaders | GLSL files under `src/shaders/`, loaded by `vite-plugin-glsl` |

There is **no test runner, no linter and no CI**. `tsc` is the only automated
check the repo has. See [BACKLOG.md](BACKLOG.md).

`motion` and `troika-three-text` are in `package.json` but are reached only from
`src/js/classes/WebGLText.ts`, which belongs to the untouched original demo. The
one-pager imports neither.

## Three entry points, one build

`vite.config.ts` registers three HTML inputs, and all three ship:

| Page | Entry | What it is |
| ---- | ----- | ---------- |
| `index.html` | `src/js/onepage/main.ts` | The one-pager |
| `config.html` | `src/js/config.ts` | Tuning page. Runs `index.html` in an iframe and writes into its `TUNE` object live; ships no scene of its own |
| `original.html` | `src/js/main.ts` | The codrops demo, kept verbatim for reference |

`original.html` also pulls two scripts off `tympanus.net` at runtime. That is a
real problem for anything deployed — see [BACKLOG.md](BACKLOG.md).

## The four load-bearing ideas

Everything else is detail. These four are what you have to hold in your head.

### 1. The DOM panels are the clock

`src/css/onepage.css` declares a height per panel:

```css
--panel-hero: 100vh;
--panel-hold: 240vh;
/* … */
--panel-etch: 300vh;
```

`Director.ts` measures every `[data-panel]` element's `offsetTop` and
`offsetHeight` and turns raw scroll into a named 0→1 phase per panel. Nothing in
the scene knows about pixels of scroll; every module is handed a `Phases` object
and reads the one value it cares about.

**So: re-timing the page is a CSS edit.** Make a panel taller and that beat gets
slower, and no JavaScript changes. This is the single best property of the
codebase and it is worth protecting.

The panels currently total about **2,095vh** — roughly twenty-one screens of
scrolling from top to bottom.

### 2. One world unit is one CSS pixel — until it isn't

The camera sits at `z = 1000` with a field of view chosen so that one three.js
unit measures exactly one CSS pixel at `z = 0` (`Commons.distanceFromCamera`).
That is what lets a dozen modules lay themselves out in viewport terms and land
where the CSS says they should.

`CameraRig` is where that stops being true. From the crossing (`flip`) onward the
camera rides a Bézier and the second level places its content in path units.
Anything that still has to be measured in pixels after that point is **held
against the camera** instead of stood in the world — `DeformArrow.escort()`,
`AnvilText`, `NegativeBands`, `EtchedLines` all do this, all the same way:

```ts
const held = /* distance in front of the lens, px */;
const perspective = held / this.commons.distanceFromCamera;

local.set(x * perspective, y * perspective, -held);
group.position.copy(camera.localToWorld(local));
group.quaternion.copy(camera.quaternion);
group.scale.setScalar(fit * perspective);
```

Copy that block when you add anything to the second level. The `perspective`
factor is what buys back the pixel convention at a depth the lens magnifies.

### 3. The copy lives in the DOM

Every word the scene draws is in `index.html` as visually hidden markup, marked
with `data-webgl`:

```html
<h1 class="visually-hidden" data-webgl="banner">…</h1>
<p data-webgl="paragraph">…</p>
<p data-webgl="core">…</p>
<p data-webgl="drift">…</p>
<p data-webgl="etch">…</p>
```

Screen readers and crawlers get real text; WebGL renders what is written there.
Change the markup and the scene follows on reload.

The loop closes both ways in dev: `src/dev/copy-writer.ts` is a Vite plugin
(`apply: "serve"`, so it never reaches a build) that lets the config page POST
edited copy back into `index.html` on disk. It finds elements by their
`data-webgl` marker and swaps only the text between the tags — classes, comments
and the rest of the file survive untouched.

**Adding a new kind of copy means touching five places**, and missing one fails
quietly:

1. `index.html` — the markup
2. `tuning.ts` — the `Copy` interface, `readCopy()`, `applyCopy()`
3. `config.ts` — the editor field and `toMarkup()`
4. `copy-writer.ts` — the `Copy` shape, `isCopy()`, `writeCopy()`
5. The module that reads it, via `document.querySelectorAll('[data-webgl="…"]')`

### 4. Everything hangs off scroll, nothing off a clock

There is no timeline and no playback anywhere in the one-pager. A letter's
position is a *function of where the scroll is*, which is why every beat runs
backwards as readily as forwards — scroll up and the block reassembles, the
ground comes back, the letters return to the surface.

The two deliberate exceptions are the sphere's departure (`TUNE.depart.time`)
and the glitch tear (`TUNE.glitch.time`), both fired by the click.

**When adding a beat, resist the timer.** If it cannot be expressed as a function
of a phase value, it will be the one thing on the page that breaks when someone
scrolls back up.

## The scroll gate

`.page[data-locked="true"]` collapses every panel past the sphere to zero height,
so the document ends at the sphere and the wheel cannot get past it. The markup
stays in place — only the height goes — so the copy below is still readable to
screen readers and crawlers while it is locked.

Clicking the sphere sets `data-locked="false"`, and both lenis and `Director`
are told to re-measure. The tail is cut to exactly one viewport while locked, so
unlocking adds height *below* the reader and nothing they can see moves.

`LOCKED` in `src/js/onepage/main.ts` lists the panels this applies to. **A new
panel after the sphere has to be added there and to the two CSS rules**, or the
config page's jump targets will land in a zero-height region.

## Tuning

`TUNE` in `src/js/onepage/settings.ts` holds every number the scene is tuned
with, in one mutable object. Mutable on purpose: `config.html` writes straight
into it, so a slider moves the scene on the next frame.

That imposes one rule with no compiler behind it:

> **Read `TUNE` per frame or on the next `onResize()`. Never capture a value in
> a module-level `const`.** A captured value is a knob that silently stops
> working, and nothing will tell you.

`tune-schema.ts` describes which knobs the panel shows. A value with no entry
there is invisible in the UI; an entry whose `path` no longer exists shows up as
a dead row. Both are caught by opening the page once, which is cheaper than a
test — and is currently the only way they are caught at all.

Knobs marked `structural: true` are read while laying out rather than per frame,
so turning one triggers a rebuild instead of waiting for the next frame.

## Repository layout

```
index.html              The one-pager — markup, copy, panels
config.html             Tuning page shell
original.html           The codrops demo, untouched
vite.config.ts          Three build inputs, GLSL plugin, copy-writer plugin

src/
  css/                  onepage.css is where the scroll story is timed
  shaders/onepage/      arrow, grid, sphere, post
  dev/                  copy-writer — dev-only, writes copy into index.html
  js/
    main.ts             Original demo entry
    config.ts           Tuning page
    classes/            Commons (camera, renderer, lenis), and the original
                        demo's WebGLText / PostProcessing
    onepage/            The one-pager. main.ts is the entry; Director.ts turns
                        scroll into phases; settings.ts holds TUNE; one class
                        per beat.

packages/onepage-chrome/   React components + design tokens lifted out of the
                           page's DOM chrome. NOT a workspace, not part of the
                           root build — it has its own package.json and lockfile
                           and is built on its own.

doc/                    This folder
```

`packages/onepage-chrome/.design-sync/` holds the config and the notes for the
design-sync pipeline. **Read its `NOTES.md` before touching that package** — it
documents several traps that have already cost a run each.

## Deployment

Vercel, project `grantig-portfolio-template` under the team
`throwingsnows-projects`. Deployment Protection is on, so preview URLs need a
login or a bypass token to open in a browser; `vercel curl <url>` reaches them
from the CLI.

`vercel deploy` uploads the working directory, so uncommitted work *is* included
in a CLI deploy. Deploys triggered from Git are not. Worth remembering when a
preview shows something the branch does not.

## House style

Worth naming, because it is unusually consistent and easy to break by accident.

- **Comments explain the decision, not the mechanism.** Nearly every non-obvious
  block says why it is that way and what happens if it isn't. Match the density —
  it is high, and it is the reason the codebase is navigable at all.
- **Commit subjects are imperative and concrete**, describing the change as an
  event in the page: *"End the ride with the level's words dropped on the arrow"*.
  Bodies explain the reasoning at length.
- **Names come from what the thing does in the story**, not from its type:
  `SurfaceGate`, `GravityWell`, `ChargeMeter`, `DeformArrow`, `NegativeBands`,
  `EtchedLines`.
- **Deliberate limitations are documented as design.** `EtchedLines` relies on
  WebGL drawing every line one pixel wide; the note in `Typography.outline()`
  says so, so nobody "fixes" it later.
