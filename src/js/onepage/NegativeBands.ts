import * as THREE from "three";

import Commons from "../classes/Commons";
import { Strip } from "./AnvilText";
import { TUNE } from "./settings";

interface Props {
  scene: THREE.Scene;
}

/** How far the bands are kept off the camera's near plane, in pixels. */
const CLIP_MARGIN = 120;

/**
 * A little wider and a little taller than the frame asks for. Two bands that
 * meet exactly on a pixel row leave a hairline of the old ground between them
 * on some devicePixelRatios, and a band whose outer edge lands exactly on the
 * frame edge shows a seam the moment the lens has any barrel to it at all.
 */
const BLEED = 1.03;

/**
 * The ground the lines take with them.
 *
 * Every line of the block that is shoved out of the frame drags a band of the
 * inverted ground in behind it, exactly as tall as its own letters. The band is
 * held at the line's own distance from the lens but *behind* the block, so what
 * flips is the ground and nothing else: the letters still standing keep their
 * ink, and a line crossing a band it did not cut is read against it rather than
 * inverted with it.
 *
 * The colour is taken from the scene's own clear colour every frame instead of
 * being written down. The second level fades its ground in over the crossing
 * and the config page can repaint it outright — a negative that was worked out
 * once would be the negative of a ground that is no longer there.
 */
export default class NegativeBands {
  private commons: Commons;
  private group = new THREE.Group();
  private scene: THREE.Scene;

  private geometry = new THREE.PlaneGeometry(1, 1);
  private material: THREE.MeshBasicMaterial;

  /** Grown to whatever the block has lines, and kept — bands are cheap. */
  private bands: Array<THREE.Mesh> = [];

  private negative = new THREE.Color();
  private reading = new THREE.Color();
  private local = new THREE.Vector3();

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;

    // Unlit and unfogged on purpose: this is not a surface in the world, it is
    // the ground itself. A band the fog could reach would go grey at exactly
    // the distance it is held at, which is the one thing it must not do.
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      fog: false,
      toneMapped: false,
    });

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * Held against the camera in the same pixel convention as the block, one
   * step further out. Must be called after `AnvilText.update()` — the strips
   * are what that has already worked out for this frame.
   */
  update(strips: Array<Strip>) {
    this.group.visible = strips.length > 0;
    if (!this.group.visible) return;

    const camera = this.commons.camera;
    const { anvil, strip } = TUNE;

    const held = Math.max(
      anvil.depth + strip.behind,
      camera.near + CLIP_MARGIN
    );
    const perspective = held / this.commons.distanceFromCamera;

    const frame = window.innerWidth * BLEED;

    // Read out and written back in sRGB, not in the colour space three keeps
    // its working values in. A ground of #f2efe6 inverted linearly comes back
    // as a mid navy — perfectly correct as light, and nothing like the negative
    // anyone means by the word. In sRGB the same ground gives #0d1019, which is
    // the black the page opened on.
    const ground = this.scene.background as THREE.Color | null;

    if (ground) {
      ground.getRGB(this.reading, THREE.SRGBColorSpace);
      this.negative.setRGB(
        1 - this.reading.r,
        1 - this.reading.g,
        1 - this.reading.b,
        THREE.SRGBColorSpace
      );
    }

    this.material.color.copy(this.negative);

    camera.updateMatrixWorld();

    this.grow(strips.length);

    this.bands.forEach((band, index) => {
      const cut = strips[index];

      if (!cut) {
        band.visible = false;
        return;
      }

      band.visible = cut.cover > 0.0005;
      if (!band.visible) return;

      const width = frame * cut.cover;

      // Anchored to the edge the line came in from, not to the middle: the band
      // grows out of that edge and its far edge is what chases the line.
      const centre = -cut.side * ((frame - width) / 2);

      band.scale.set(
        width * perspective,
        cut.height * BLEED * perspective,
        1
      );

      this.local.set(centre * perspective, cut.y * perspective, -held);
      band.position.copy(camera.localToWorld(this.local));
      band.quaternion.copy(camera.quaternion);
    });
  }

  /** One mesh per line, made on the first frame a line needs one. */
  private grow(count: number) {
    while (this.bands.length < count) {
      const band = new THREE.Mesh(this.geometry, this.material);
      band.visible = false;
      this.bands.push(band);
      this.group.add(band);
    }
  }
}
