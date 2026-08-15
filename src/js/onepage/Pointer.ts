import * as THREE from "three";

/**
 * Pointer tracking in two flavours:
 * - `ndc`: normalized device coordinates for raycasting.
 * - `world`: position on the z = 0 plane. Because the camera's fov is synced to
 *   the viewport, one world unit equals one CSS pixel there, so this is just the
 *   cursor position relative to the center of the screen.
 */
export default class Pointer {
  ndc = new THREE.Vector2();
  world = new THREE.Vector2();
  /** Eased version of `world`, used for anything that shouldn't snap. */
  smooth = new THREE.Vector2();
  /** -1 → 1 on both axes, eased. Handy for parallax. */
  tilt = new THREE.Vector2();

  active = false;

  constructor() {
    window.addEventListener("pointermove", this.onPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", this.onPointerLeave);
  }

  private onPointerMove = (event: PointerEvent) => {
    const { innerWidth: w, innerHeight: h } = window;

    this.ndc.set((event.clientX / w) * 2 - 1, -(event.clientY / h) * 2 + 1);
    this.world.set(event.clientX - w / 2, -(event.clientY - h / 2));
    this.active = true;
  };

  private onPointerLeave = () => {
    this.active = false;
  };

  update() {
    // When the pointer left the window we drift back to the center.
    const targetX = this.active ? this.world.x : 0;
    const targetY = this.active ? this.world.y : 0;

    this.smooth.x += (targetX - this.smooth.x) * 0.1;
    this.smooth.y += (targetY - this.smooth.y) * 0.1;

    this.tilt.set(
      this.smooth.x / (window.innerWidth / 2),
      this.smooth.y / (window.innerHeight / 2)
    );
  }

  dispose() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave);
  }
}
