# Roadmap

> **This is a proposal, not a plan.** Nothing in here has been agreed. It is
> derived from what is in the repository on 2026-08-26 and from what
> [BACKLOG.md](BACKLOG.md) says is open — not from anyone's stated intention for
> the project. Cross out what is wrong; the themes matter more than the order.

Horizons rather than dates: **Now** is what the current state argues for next,
**Next** is what becomes worth doing once Now is done, **Later** is real but not
yet shaped.

---

## The one question underneath all of this

The repository is called `grantig-portfolio-template`. What it contains is a
single fixed narrative with lorem ipsum in it, eleven beats long, tuned end to
end for the exact copy it ships with.

Those are two different products:

- **A template** — someone drops in their own work, their own words, their own
  images, and gets this. Needs the story to survive content it was not tuned for.
- **A portfolio piece** — *this* page, with real copy and real work in it,
  finished and shipped as itself. The story stays exactly this story.

Almost everything below is cheap under one reading and expensive under the other,
so it is worth answering before committing to any of it. **The roadmap below
assumes the template reading**, because the repository name does. If that is
wrong, say so and theme 1 collapses to "write the real copy" and the rest
reshuffles.

---

## Now

### 1. Land what is built
Merge `onepage-strip-panel`. Two verified panels — `strip` and `etch` — sit on a
branch while `main` does not have them, and every day that continues is a day
the branch and `main` can diverge for no reason.

Then clear the loose working tree with it: the design-sync placeholder text, the
uncommitted `.gitignore` line, the untracked `.vite/`.

*Covers B1, B2, B3.*

### 2. Stop shipping someone else's analytics
`original.html` is a build input, and it loads an analytics script and an ad
script off `tympanus.net` on every visit. That is not a thing to leave running
on a deployed site while deciding what to do about it. Decide whether the
original demo needs a URL at all; if it does not, dropping it from the build
inputs also lets two dependencies go.

*Covers B4, B5.*

### 3. A push that can fail
There is no linter, no formatter and no CI. `tsc` is the only check and it runs
only when someone remembers. One GitHub Action running `tsc` on push is an hour
of work and is the difference between "the build is fine" being a belief and
being a fact.

*Covers B14, and makes B16 worth writing.*

---

## Next

### 4. Make the story survive other people's content
This is the theme that turns the repository's name into the truth, and it is
much larger than it looks.

Right now the copy budgets in `config.html` exist precisely because the scene is
tuned to the lorem it ships with — a longer paragraph is not a layout problem,
it is more meshes and more physics bodies. And the `etch` panel wants exactly one
line of copy per band, where the band count falls out of `TUNE.anvil.columns`
and the word list.

The work is roughly:
- Establish what actually breaks past each budget, and write it down (B19).
- Decide what degrades and what refuses. A page that quietly gets slower is
  worse than one that says the copy is too long.
- Real copy in place of the lorem, as the first honest test of all of it (B18).

*Covers B18, B19; makes B13 measurable.*

### 5. Decide what the page does for people it currently excludes
Three separate questions that get filed together and should not be:

- **Reduced motion** (B10). The page has one reduced-motion rule and it disables
  a label animation. Twenty-one screens of scroll-driven movement ignore the
  preference. Needs an actual answer to "what is this page when motion is not
  allowed", not a smaller version of the same thing.
- **No WebGL** (B11). The cheapest of the three by a distance — the copy is
  already in the DOM, so revealing it is close to a stylesheet.
- **Touch and small screens** (B12). The largest. The banner wants a pointer,
  the sphere wants a click, and nothing has been tried.

Doing B11 first is worth it on its own: it forces the fallback stylesheet to
exist, which both of the others then build on.

### 6. Know the frame cost
Nothing has been profiled and there is no number anyone is holding to. Before
theme 4 makes the content variable, it is worth knowing what the *fixed* content
costs on a mid-range laptop and on a phone — otherwise the first real copy that
makes the page stutter will be indistinguishable from a regression.

*Covers B13.*

---

## Later

### 7. Tests where they are honestly possible
The codebase repeatedly and correctly prefers "open the page once" to a test.
That holds for anything whose output is pixels. It does not hold for `Director`'s
phase arithmetic, `Typography.layout()`'s wrapping, `copy-writer`'s rewrite of
`index.html`, or a walk over `TUNE` against `tune-schema.ts` looking for knobs
that are invisible and rows that are dead.

Worth doing after theme 4, when the copy pipeline stops being the thing most
likely to change.

*Covers B15, B16.*

### 8. Harden the design-sync loop
`packages/onepage-chrome` has a careful set of notes about traps that have each
cost a run. Several of them are notes where a guard would do: preview copy
drifting from `index.html` with nothing detecting it (B8), the `HintAtPeak`
helper duplicated five times (B9), `cssEntry` pointing at a build artifact that
can be stale (B17).

Low urgency while that package is not being changed often. It becomes urgent the
moment it is.

### 9. A second story
The architecture argues for this more than anyone has asked for it: the panels
are the clock, the copy is in the DOM, and `Director` does not care what the
panel names mean. A different sequence of beats over the same machinery is
mostly a different `index.html`, a different stylesheet and a different set of
modules under `src/js/onepage/`.

Only worth naming as a direction — it should not be attempted before theme 4,
because a second story built on content assumptions that only hold for the lorem
would double the problem instead of proving the architecture.

---

## Explicitly not planned

Written down so they stop being re-proposed.

- **A framework.** There is no React, Vue or Svelte in the one-pager and nothing
  in it wants one. The DOM is a dozen elements and a `data-locked` attribute.
- **Replacing the panels-as-clock design.** Re-timing the page by editing CSS is
  the best property the codebase has.
- **A timeline or animation library for the scroll story.** Everything hanging
  off scroll position rather than off a clock is why every beat runs backwards.
  The two timer-driven exceptions are both fired by the click and both
  documented.
- **Making `packages/onepage-chrome` a workspace of the root project.** It is a
  separate package with its own lockfile on purpose, and `.design-sync/config.json`
  pins `shape: "package"` around that assumption.
