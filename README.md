# Lorem Ipsum One-Pager

A scroll-driven one-page WebGL experience: a 3D headline that reacts to the
pointer, an arrow that deforms with the scroll, text flying in from every side,
and letters that get handed over to a physics engine and pile up on a node.

Built on top of the [codrops WebGL text demo](#original-demo) — three.js, lenis
and a velocity-driven post-processing pass — extended with `cannon-es` for the
falling letters.

## Getting started

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/ThrowingSnow/codrops-text-demo.git
cd codrops-text-demo
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

| Route            | What it is                                       |
| ---------------- | ------------------------------------------------ |
| `/`              | The one-pager                                     |
| `/original.html` | The original codrops demo, untouched              |

Both are built by `npm run build`; they are registered as separate Vite inputs
in `vite.config.ts`.

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
   and the letters pile up on the node in the lower 12.5% of the viewport.
   Scrolling back up resets them.

## Editing the page

**The copy** lives in `index.html` as visually hidden DOM — that's what screen
readers and crawlers see, and it is also what WebGL renders. Change the text
there and the scene follows:

```html
<h1 class="visually-hidden" data-webgl="banner">Lorem ipsum dolor sit amet</h1>
...
<p data-webgl="paragraph">Ut enim ad minim veniam quis nostrud …</p>
```

**The timing** is defined by the section heights in `src/css/onepage.css` — the
`--panel-*` custom properties. `Director.ts` reads the panels' offsets from the
DOM, so lengthening a section in CSS re-times that part of the story, no
JavaScript involved.

**Colors, the 75% content width and the height of the node** live in
`src/js/onepage/settings.ts`.

### Project structure

```
index.html                 the one-pager
original.html              the original codrops demo
src/css/onepage.css        layout, frame, HUD, scroll section heights
src/js/onepage/
  main.ts                  entry point: scene, lights, frame loop
  Director.ts              turns scroll into named phases
  Typography.ts            font loading, glyph geometry cache, text layout
  BannerText.ts            the 3D headline and its pointer reaction
  DeformArrow.ts           the deforming arrow
  ChargeMeter.ts           the value that has to be reached
  LetterField.ts           fly-in, cannon-es physics, the pile
  NodePlatform.ts          the node the letters land on
  Pointer.ts               pointer tracking
  PostFX.ts                wave + RGB shift + vignette pass
src/shaders/onepage/       the shaders for the arrow and the pass
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
