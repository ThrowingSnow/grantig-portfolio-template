import * as THREE from "three";

import Commons from "../classes/Commons";
import { COLORS, TUNE, sphereRadius } from "./settings";

import fragmentShader from "../../shaders/onepage/grid.frag";
import vertexShader from "../../shaders/onepage/grid.vert";

interface Props {
  scene: THREE.Scene;
}

const COLUMNS = 46;
const ROWS = 30;

/**
 * The gravitational grid behind the sphere: a plain quad grid whose vertices are
 * pulled into the well by the vertex shader. This is what makes the mass legible
 * — without it the sphere is just a black circle.
 */
export default class GravityGrid {
  private commons: Commons;
  private lines: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();

    this.lines = new THREE.LineSegments(
      this.createGeometry(),
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: new THREE.Vector2(1, 1) },
          uRadius: { value: sphereRadius() * TUNE.grid.reach },
          uDepth: { value: TUNE.grid.depth },
          uReveal: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: COLORS.grid.clone() },
          uHot: { value: COLORS.accent.clone() },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      })
    );

    this.lines.visible = false;
    // The size lives in the shader, so the geometry's own bounds are meaningless.
    this.lines.frustumCulled = false;

    scene.add(this.lines);

    this.onResize();
  }

  /**
   * A quad grid built by hand — `WireframeGeometry` on a plane would draw the
   * triangulation's diagonals as well, which reads as noise once it bends.
   */
  private createGeometry() {
    const positions: Array<number> = [];

    for (let row = 0; row <= ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        positions.push(column, row, 0, column + 1, row, 0);
      }
    }

    for (let column = 0; column <= COLUMNS; column++) {
      for (let row = 0; row < ROWS; row++) {
        positions.push(column, row, 0, column, row + 1, 0);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    // Built in cell units and normalized here, so a resize is a scale.
    geometry.translate(-COLUMNS / 2, -ROWS / 2, 0);
    geometry.scale(1 / COLUMNS, 1 / ROWS, 1);

    return geometry;
  }

  onResize() {
    // Overscanned, so the bent edges never pull into view. The size is applied
    // in the shader, not as a scale — the dent has to be measured in pixels.
    this.lines.material.uniforms.uSize.value.set(
      window.innerWidth * 2.1,
      window.innerHeight * 2.1
    );
    const uniforms = this.lines.material.uniforms;

    uniforms.uRadius.value = sphereRadius() * TUNE.grid.reach;
    uniforms.uDepth.value = TUNE.grid.depth;

    this.lines.position.z = -TUNE.grid.distance;
  }

  update(reveal: number) {
    this.lines.visible = reveal > 0.002;
    if (!this.lines.visible) return;

    this.lines.material.uniforms.uReveal.value = reveal;
    this.lines.material.uniforms.uTime.value = this.commons.elapsedTime;
  }
}
