# One-Pager: 3D Banner, Deforming Arrow & Falling Letters

`index.html` is a scroll-driven one-pager built on top of this demo's setup
(three.js + lenis + a velocity-driven post-processing pass). The original
codrops demo still lives in `original.html`.

The scroll story, in four beats:

1. **Banner** — five words of lorem ipsum, every character an extruded 3D mesh.
   The pointer pulls the letters towards the camera (magnetic falloff) and the
   glyph under the cursor is highlighted via raycast.
2. **Hold** — an arrow in the middle of the screen, deformed by a wave in its
   vertex shader plus an RGB split, while a meter charges up from the center
   until it spans the full 75% content width.
3. **Assemble** — once that value is reached, three paragraphs fly in from every
   side of the viewport and settle into the 75% column.
4. **Gravity** — the second scroll hands every letter over to `cannon-es`. The
   scroll velocity drives both the release impulse and the strength of gravity,
   and the letters pile up on the node in the lower 12.5% of the screen.
   Scrolling back up resets them.

The copy lives in the DOM (visually hidden) and is read from there, so the page
stays readable for screen readers and crawlers.

Source: `src/js/onepage/`, styles in `src/css/onepage.css`, shaders in
`src/shaders/onepage/`.

---

# Creating Responsive and Accessible WebGL Text With Three.js and Troika

![Featured Image](https://tympanus.net/codrops/wp-content/uploads/2025/04/Featured-image.png)

[Article on Codrops](https://tympanus.net/codrops/?p=92085)

[Demo](https://tympanus.net/Tutorials/AccessibleWebGLText/)

## Installation

Install dependencies:

```
npm run install
```

Start compiling and running a [local server](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Tools_and_setup/set_up_a_local_testing_server):

```
npm run dev
```

Building application:

```
npm run build
```

View build on a local server:

```
npm run preview
```

## Credits

## Misc

Follow Eemeli: [X](https://x.com/eemelihaakana)

Follow Codrops: [Bluesky](https://bsky.app/profile/codrops.bsky.social), [Facebook](http://www.facebook.com/codrops), [GitHub](https://github.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [X](http://www.x.com/codrops)

## License

[MIT](LICENSE)
