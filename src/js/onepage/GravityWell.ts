import * as THREE from "three";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import {
  COLORS,
  TUNE,
  clamp01,
  easeOutBack,
  smoothstep,
  sphereRadius,
} from "./settings";

import fragmentShader from "../../shaders/onepage/sphere.frag";
import vertexShader from "../../shaders/onepage/sphere.vert";

interface Props {
  scene: THREE.Scene;
}

/**
 * The black sphere in the middle of the void.
 *
 * It only owns the visuals, its own reveal and its retreat — the force it
 * appears to exert on the letters is applied in `LetterField`, which is where
 * the physics world is. The reveal is monotone: once the sphere is there,
 * scrolling back up must not make it flicker in and out while the letters are
 * still orbiting it.
 *
 * After the click it drives itself away from the camera instead of staying put.
 * The scene fog reaches full density at 2600, so a sphere travelling that far
 * back dissolves into the background rather than shrinking to a visible dot.
 */
export default class GravityWell {
  private commons: Commons;
  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  /** Set from the DOM button that sits on top of the sphere. */
  hovered = false;

  private reveal = 0;
  private eased = 0;
  private hover = 0;

  private departing = false;
  private departed = 0;

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();

    this.mesh = new THREE.Mesh(
      // Unit sphere — the radius lives in the scale, so a resize is one line.
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uRim: { value: COLORS.accent.clone() },
          uCold: { value: COLORS.cold.clone() },
        },
        vertexShader,
        fragmentShader,
      })
    );

    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /**
   * 0 → 1, how present the sphere is. Drives the lens in the post pass and the
   * dent in the grid, so both fade out on their own while it leaves.
   */
  get strength() {
    return clamp01(this.eased) * (1 - smoothstep(0, 0.85, this.departed));
  }

  /** 0 → 1 while the sphere is retreating. */
  get departure() {
    return this.departed;
  }

  /**
   * Current on-screen radius in pixels. The geometry is a unit sphere, so the
   * scale *is* the world radius — but once it recedes, perspective shrinks it,
   * and the post pass needs the projected size to keep its lens on the sphere.
   */
  get screenRadius() {
    const distance = this.commons.distanceFromCamera - this.mesh.position.z;
    return (this.mesh.scale.x * this.commons.distanceFromCamera) / Math.max(1, distance);
  }

  /** Called when the sphere is clicked: it backs out of the scene. */
  depart() {
    this.departing = true;
  }

  update(phases: Phases, delta: number) {
    const { gravity, split, orbit, flip } = phases;

    // Scrolled all the way back out of the fall: the whole void is rolled up.
    if (gravity <= 0) {
      this.reveal = 0;
      this.departing = false;
      this.departed = 0;
      this.mesh.position.z = 0;
    } else {
      this.reveal = Math.max(
        this.reveal,
        Math.max(smoothstep(0.3, 0.95, split), orbit > 0 ? 1 : 0)
      );
    }

    if (this.departing) {
      // Tied to the beat `LetterField` keeps clear before the new copy comes
      // forward, but running slightly past it: the last of the mass should
      // still be fading while the first letters arrive, so they read as coming
      // out of it rather than after it.
      const span = TUNE.depart.time * Math.max(0.1, TUNE.core.overlap) * 1.25;
      this.departed = Math.min(1, this.departed + delta / span);
    }

    const rate = Math.min(1, delta * 2.6);
    this.eased += (this.reveal - this.eased) * rate;
    this.hover += ((this.hovered ? 1 : 0) - this.hover) * Math.min(1, delta * 6);

    // Past the crossing the sphere is simply not part of the world any more,
    // whether it was ever clicked or not — a reader who scrolls straight
    // through must not drag it into the second level.
    this.mesh.visible = this.eased > 0.002 && this.departed < 1 && flip <= 0;
    if (!this.mesh.visible) return;

    const time = this.commons.elapsedTime;

    this.mesh.material.uniforms.uTime.value = time;
    this.mesh.material.uniforms.uHover.value = this.hover;

    const grow = easeOutBack(clamp01(this.eased));
    const pulse = 1 + Math.sin(time * 1.3) * 0.012 + this.hover * 0.05;

    this.mesh.scale.setScalar(Math.max(0.0001, sphereRadius() * grow * pulse));

    // Accelerating away rather than gliding: the mass looks like it is falling
    // out of the scene, and the letters it drags read as being left behind.
    this.mesh.position.z = -TUNE.depart.distance * this.departed * this.departed;
    this.mesh.rotation.y = time * 0.06;
  }

  onResize() {
    // Nothing to do — the radius is read from the viewport every frame.
  }
}
