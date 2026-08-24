# Lorem Ipsum One-Pager

A scroll-driven one-page WebGL experience: a 3D headline that reacts to the
pointer, an arrow that deforms with the scroll, text flying in from every side,
letters that get handed over to a physics engine and pile up on a surface — and a
surface that swings open in the middle to drop them into a gravity well, where a
black sphere catches them, and a click sends it out of the scene — towing the
whole swarm into the depth with it, before the next block of copy pops back out
of that same depth, spelled with the same letters. Past that, a second level
the camera rides through, ending on a block of text that comes apart one line
per scroll threshold and leaves the negative of the ground behind it — and a
last panel that writes into those bands in hairline letters.

Built on top of the [codrops WebGL text demo](#original-demo) — three.js, lenis
and a velocity-driven post-processing pass — extended with `cannon-es` for the
falling letters.

## Getting started

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/ThrowingSnow/grantig-portfolio-template.git
cd grantig-portfolio-template
npm install
npm run dev
```

Then open the URL Vite prints, usually <http://localhost:5173/>.

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm install`     | Installs the dependencies                              |
| `npm run dev`     | Dev server with hot reload, usually on port 5173       |
| `npm run build`   | Type-checks with `tsc` and builds to `dist/`           |
| `npm run preview` | Serves the production build, usually on port 4173      |

### Pages

| Route            | What it is                                        |
| ---------------- | ------------------------------------------------- |
| `/`              | The one-pager                                     |
| `/config.html`   | Tuning page — the one-pager plus a panel of knobs  |
| `/original.html` | The original codrops demo, untouched              |

All three are built by `npm run build`; they are registered as separate Vite
inputs in `vite.config.ts`.

The page needs WebGL, so use a desktop browser — and a mouse or trackpad, since
the headline reacts to the pointer.

## The scroll story

1. **Banner** — five words of lorem ipsum, every character an extruded 3D mesh.
   The pointer pulls nearby letters towards the camera with a magnetic falloff,
   and the glyph directly under the cursor is highlighted via raycast.
2. **Hold** — an arrow in the middle of the screen, deformed by a wave running
   through its geometry plus an RGB split, both driven by scroll velocity. Next
   to it a meter charges up out of the center until it spans the full 75%
   content width.
3. **Assemble** — once that value is reached, three paragraphs fly in from every
   side of the viewport, staggered per letter, and settle into the 75% column.
4. **Gravity** — the second scroll hands every letter over to `cannon-es`. The
   scroll velocity drives both the release impulse and the strength of gravity,
   and the letters pile up on the surface in the lower 12.5% of the viewport.
   Scrolling back up resets them.
5. **Split** — the surface swings open in the middle. Both halves are kinematic
   bodies, so the pile really does slide off the tilting plates and falls through
   the gap.
6. **Orbit** — the void below: gravity is handed over to a black sphere in the
   middle of the screen, which catches the falling letters and holds them in
   orbit around itself. A grid behind it is dented by the same mass.
7. **Core** — clicking the sphere sends it backwards out of the scene, and it
   takes the *whole* swarm with it. The orbit does not stop, it tightens: each
   letter keeps circling on the axis it already had while its radius is reeled
   in, so the swarm winds itself into the mass instead of falling into it. It
   shrinks as it goes, so it ends up gone rather than merely small and the
   frame empties out completely. Only then does the new copy pop forward out of that
   depth, staggered letter by letter, each one overshooting its place and
   ringing out before it settles.

   The meshes are recycled rather than rebuilt: the E in the new block is a
   letter that was orbiting a moment ago, so no glyph is extruded twice. A
   character the paragraphs never contained is conjured on the spot instead of
   being towed — it simply arrives with the rest — so the copy stays swappable,
   see [Editing the page](#editing-the-page).

**The sphere is a gate, not an ornament.** Steps 8 to 12 hang off
`data-locked` on `.page`: until the click their panels have no height, so the
document ends at the sphere and the wheel has nowhere left to go. The tail is cut
to exactly one viewport at the same time, which puts the last scrollable pixel on
the first pixel of the sweep panel — unlocking adds height below the reader, and
nothing they can see moves. Scrolling back out of the fall locks it again, so the
sphere can hold the next pass too. The markup is never removed, only flattened:
the copy down there stays readable to screen readers and crawlers throughout.

8. **Sweep** — scrolling on brings the arrow back. It comes in from the left or
   the right — drawn fresh every run, so the same page twice is not the same
   shot twice — lays itself on its side and drives through the block. Its
   position is mapped straight off the scroll rather than played back on a
   timer: you push it through the text with the wheel.

   Nothing fades. Every letter its point has gone past is handed back to
   `cannon-es` and struck, so what leaves the frame is the same matter that
   arrived in it. Scrolling back off the panel takes the bodies out again and
   the line stands as it was.

9. **Flip** — the crossing, and deliberately short: three quarters of a screen.
   The ground goes from near-black to pale, the fog travels with it, and the
   camera comes off the fixed spot it has held for eight panels. Everything the
   first level owns is dismissed here whether it was ever used or not — a reader
   who never clicks the sphere must not drag it into what follows.

   The arrow is the exception: instead of leaving with the rest it curves back
   out of its run into the middle of the frame, swings down to point the way the
   reader is going, and stays. Its core travels from pale to the level's ink on
   the way, because a near-white arrow on a near-white ground is no arrow.

10. **Drift** — the second level. The camera rides a path of three cubic Béziers
    past a run of word gates, set in a different typeface (Gentilis, against the
    Helvetiker everything above uses) and laid out in world space rather than in
    screen pixels. The horizon rolls into the turns; a wave runs through the
    letters, driven by scroll velocity like everything else on the page.

    And the arrow is still there, held in front of the lens while the level is
    flown past it. That is the inversion the whole crossing was for: above it
    the arrow travelled across a frame that stood still, here the frame stands
    on the arrow and the world does the moving. It swings, banks into its swings
    and — because the words stand off to the side of the path — weaves in depth
    as it goes, diving behind one gate and coming back out in front of the next
    without ever leaving the middle of the picture.

11. **The anvil** — the last beat, at the bottom of the same panel. The words
    the reader has been meeting one at a time come back all at once: set solid,
    fitted to the frame, dropping in from above it on an accelerating fall and
    landing with a rebound. The arrow's swings are talked down to nothing on the
    way in, so it is standing still in the middle when the block arrives — and
    then it is driven out through the bottom of the frame, tumbling and torn
    apart by its own RGB split as it goes.

    The page has spent ten panels running an arrow through text. It ends with
    the text running over the arrow. The block is held against the camera, like
    the arrow beside it, because by now the rig is somewhere down the far end of
    the Bézier and something that has to fill the frame has no business being
    anywhere the lens is not.

12. **Strip** — a panel of its own, and the only one on the page whose beats are
    thresholds rather than a run. The block that just landed is taken apart line
    by line: every line has one place on the scroll where it goes, and crossing
    it shoves that line out of the frame — sideways, turning, out of the side it
    was dealt. It winds up against the way out first, so it reads as pushed
    rather than as sliding, and the frame tears the way it did at the click, at
    a fraction of it. The order is drawn at random when the block is built, so
    the same words twice do not come apart the same way twice.

    What each line drags in behind it is the negative of the ground it was
    standing on, in exactly its own letters' height — read off the scene's clear
    colour each frame and inverted in sRGB, not in the linear space three keeps
    its working values in, or the pale level's ground would come back as a mid
    navy instead of as the black the page opened on. The band is on the same
    slot as the line, on a slower curve, so it is always trailing whatever is
    pulling it and catches up exactly as that line clears the frame. It is held
    a step behind the block, so what flips is the ground and nothing else: the
    lines still standing keep their ink, on the pale they always had.

    Nothing here is fired and forgotten either — a line's place is a function of
    where the scroll is, so scrolling back up pulls the block, and the ground
    under it, straight back together. By the last threshold the level is gone
    and what is left is the stack of bands its lines cut out of it: the page
    ends on black and white, which is where it started.

13. **Etch** — the bands are written into. One line of copy per band, drawn as
    the glyphs' own outlines and nothing else: WebGL draws every line one pixel
    wide whatever `linewidth` says, which is usually a nuisance and here is the
    whole design — a letter that stays a hairline however large it is set reads
    as something that could break, which is what it has to be after twelve
    panels of solid, lit, extruded matter. Set in a regular cut rather than a
    bold one, because the outline of a bold face is two heavy contours running
    side by side. Its colour is the pale the bands were cut out of, so the copy
    is the positive of the ground standing in the negative of it.

    The letters are not laid down, they are thrown. Each one comes in from
    somewhere else — near and far alike, tumbling on all three axes — on its own
    moment of the scroll, and comes up out of nothing as it travels, so a letter
    still halfway across the frame is not competing with the ones that have
    landed. The order is drawn at random, so a line collects rather than
    spelling itself out left to right, and it is only a line once the last
    letter has stopped.

    The bands are read off `AnvilText` every frame rather than measured again,
    and matched by `Strip.row` — the copy for the third line of the block goes
    in the band the third line cut, whatever order they were cut in.

**This is where the page's founding convention ends.** Up to the crossing the
camera sits at z = 1000 with a fov chosen so one world unit is one CSS pixel,
which is what lets every module above lay itself out in pixels. `CameraRig` is
where that stops being true, so the second level places its content on the path
instead of on the viewport. The curve starts exactly where the camera always
stood, so at a ride of 0 the rig is a no-op and nothing above notices it exists.

## Editing the page

**The copy** lives in `index.html` as visually hidden DOM — that's what screen
readers and crawlers see, and it is also what WebGL renders. Change the text
there and the scene follows:

```html
<h1 class="visually-hidden" data-webgl="banner">Lorem ipsum dolor sit amet</h1>
...
<p data-webgl="paragraph">Ut enim ad minim veniam quis nostrud …</p>
...
<p data-webgl="core">Sed ut perspiciatis unde omnis iste natus error sit …</p>
...
<p data-webgl="drift">Adipisci</p>
...
<p data-webgl="etch">Quis autem vel eum</p>
```

The `drift` words are one per gate on the second level's ride, and the `etch`
lines are one per band — a line more than the block has lines is simply never
placed, a line less leaves that band empty.

Every character is its own mesh, and while it is falling also its own physics
body — so the copy has to stay short. Around 300 characters for the paragraphs
and 130 for the `core` block is what the scene is tuned for; anything longer
belongs in ordinary DOM.

The two are linked: the `core` block is spelled with letters taken out of the
paragraphs. Any character it needs that the paragraphs cannot supply is spawned
on the spot, so nothing breaks — but the more of it that has to be spawned, the
less it reads as the same matter rearranged. Sharing an alphabet with the
paragraphs is what makes the hand-over land, and the two lorem passages shipped
here need a single conjured glyph between them. `/config.html` reports that
count live while the copy is being edited.

Keeping the two roughly the same length matters as much as the alphabet: if the
new copy is much shorter, most of the swarm never comes back and the second half
of the move reads as a different, smaller cast. The `core` block is sized to fill
about three rows of the content width, so longer copy gets more rows rather than
smaller type.

**The timing** is defined by the section heights in `src/css/onepage.css` — the
`--panel-*` custom properties. `Director.ts` reads the panels' offsets from the
DOM, so lengthening a section in CSS re-times that part of the story, no
JavaScript involved. The locked half is the same mechanism seen from the other
side: `.page[data-locked="true"]` sets `--panel-sweep`, `--panel-flip` and
`--panel-drift` to zero and shortens `--panel-tail` to one viewport. A panel of
zero height reports a progress of 0, not 1 — otherwise reaching the sphere would
read as having scrolled clean past everything below it.

**Colors, the 75% content width, the height of the surface, the radius of the
sphere, how far the gate swings open and the tuning of the gravity well** live in
`src/js/onepage/settings.ts`, in one mutable `TUNE` object.

### Tuning

`/config.html` runs the real one-pager in a same-origin iframe and writes
straight into that object, so a slider moves the scene on the next frame. It has
buttons to jump to each phase and to click the sphere, so a knob can be judged
where it actually matters. The departure, the line it leaves behind and the tear
on the click each have their own group there — they only run once per scroll, so
the jump buttons are the only sane way to tune them.

- Values are kept in this browser's `localStorage`. **They never reach visitors**
  — the scene only exposes its handle and only reads the stored values while it
  is running inside the config frame, so the deployed page looks the same for
  everyone.
- **Copy settings** puts the current numbers on the clipboard in the shape of
  `settings.ts`. That is how a look is kept: paste it in and commit it.
- Colours are baked into materials and uniforms when the scene is built, so
  changing one reloads the frame instead of chasing every material.
- **The copy** has its own group there. Each block may run 20% either side of
  the length it ships with — every character is a mesh, and a falling one is a
  physics body too, so the budget is a real limit rather than a style rule.
  **Save to index.html** writes the text straight into the file — the config
  page posts it to a dev-server route in `src/dev/copy-writer.ts`, which swaps
  the text between the `data-webgl` tags and leaves the rest of the markup, the
  comments included, alone. It only exists while `npm run dev` is running:
  the plugin is registered `apply: "serve"`, so it is never part of a build.
  **Copy as HTML** gives the same markup back on the clipboard instead, for
  when the page is not being served from its own source. Applying reloads the
  frame either way, because the text is read once while the scene is built.
- Adding a knob means adding one entry to `src/js/onepage/tune-schema.ts`; the
  panel builds itself from that list.

The page carries `noindex`, but it is still reachable by anyone who guesses the
URL — it is a tuning tool, not a secret. There is nothing behind it but the
numbers that are in the source anyway.

### Project structure

```
index.html                 the one-pager
config.html                the tuning page
original.html              the original codrops demo
src/css/onepage.css        layout, frame, HUD, scroll section heights
src/css/config.css         the tuning page
src/js/config.ts           the tuning page's panel
src/dev/copy-writer.ts     dev-only route that saves the copy into index.html
src/js/onepage/
  main.ts                  entry point: scene, lights, frame loop
  Director.ts              turns scroll into named phases
  Typography.ts            font loading, glyph geometry cache, text layout
  BannerText.ts            the 3D headline and its pointer reaction
  DeformArrow.ts           the deforming arrow: the run, and the escort below
  ChargeMeter.ts           the value that has to be reached
  LetterField.ts           fly-in, physics, the pile, the orbit, the handover, the clearing
  SurfaceGate.ts           the surface the letters land on, and its two wings
  GravityWell.ts           the black sphere and its retreat
  GravityGrid.ts           the grid the mass dents
  CoreText.ts              where the block the swarm reassembles into sits
  CameraRig.ts             the Bézier the camera rides through the second level
  DriftText.ts             the second level: its face, its palette, its word gates
  AnvilText.ts             those same words as one block, dropped on the arrow
  Pointer.ts               pointer tracking
  PostFX.ts                wave + RGB shift + lens + tear + vignette pass
  tune-schema.ts           which settings the config page offers, and how
  tuning.ts                storing, applying and exporting those settings
src/shaders/onepage/       the shaders for the arrow, sphere, grid and the pass
src/js/classes/Commons.ts  shared camera, renderer and lenis (from the demo)
```

## Original demo

<a id="original-demo"></a>

This repository started as the demo for
**Creating Responsive and Accessible WebGL Text With Three.js and Troika**.

![Featured Image](https://tympanus.net/codrops/wp-content/uploads/2025/04/Featured-image.png)

[Article on Codrops](https://tympanus.net/codrops/?p=92085) ·
[Demo](https://tympanus.net/Tutorials/AccessibleWebGLText/)

Follow Eemeli: [X](https://x.com/eemelihaakana)

Follow Codrops: [Bluesky](https://bsky.app/profile/codrops.bsky.social), [Facebook](http://www.facebook.com/codrops), [GitHub](https://github.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [X](http://www.x.com/codrops)

## License

[MIT](LICENSE)
