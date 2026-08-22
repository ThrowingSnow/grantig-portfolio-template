import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  ShaderPass,
} from "three/examples/jsm/Addons.js";

import Commons from "../classes/Commons";
import { COLORS, TUNE, clamp01 } from "./settings";

import fragmentShader from "../../shaders/onepage/post.frag";
import vertexShader from "../../shaders/onepage/post.vert";

interface Props {
  scene: THREE.Scene;
}

export interface Lens {
  /** 0 → 1, how present the sphere is. */
  strength: number;
  /** Radius of the sphere in pixels. */
  radius: number;
}

/**
 * Wave + RGB shift pass driven by the scroll velocity, with the gravitational
 * lens around the sphere, a vignette and a touch of grain on top.
 */
export default class PostFX {
  private commons: Commons;
  private composer: EffectComposer;
  private shiftPass: ShaderPass;

  /** Elapsed time the current tear runs out at. */
  private glitchUntil = 0;

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();

    this.composer = new EffectComposer(this.commons.renderer);
    this.composer.setPixelRatio(this.commons.sizes.pixelRatio);
    this.composer.setSize(
      this.commons.sizes.screen.width,
      this.commons.sizes.screen.height
    );

    this.composer.addPass(new RenderPass(scene, this.commons.camera));

    this.shiftPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uVelocity: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: this.commons.sizes.screen.aspect },
        uLens: { value: 0 },
        uLensRadius: { value: 0.1 },
        uRing: { value: COLORS.accent.clone() },
        uDeflect: { value: TUNE.post.deflect },
        uRingAmount: { value: TUNE.post.ring },
        uGlitch: { value: 0 },
        uGlitchAmount: { value: TUNE.glitch.amount },
      },
      vertexShader,
      fragmentShader,
    });

    this.composer.addPass(this.shiftPass);
  }

  /** Fires a single tear through the frame — the click sets the mass loose. */
  glitch() {
    this.glitchUntil = this.commons.elapsedTime + TUNE.glitch.time;
  }

  onResize() {
    this.composer.setPixelRatio(this.commons.sizes.pixelRatio);
    this.composer.setSize(
      this.commons.sizes.screen.width,
      this.commons.sizes.screen.height
    );

    this.shiftPass.uniforms.uAspect.value = this.commons.sizes.screen.aspect;
  }

  update(velocity: number, lens: Lens) {
    const uniforms = this.shiftPass.uniforms;

    uniforms.uTime.value = this.commons.elapsedTime;
    uniforms.uVelocity.value = velocity;
    uniforms.uLens.value = lens.strength;
    uniforms.uDeflect.value = TUNE.post.deflect;
    uniforms.uRingAmount.value = TUNE.post.ring;
    uniforms.uGlitchAmount.value = TUNE.glitch.amount;
    uniforms.uGlitch.value = clamp01(
      (this.glitchUntil - this.commons.elapsedTime) / Math.max(0.01, TUNE.glitch.time)
    );

    // The shader measures in uv space, where the full viewport height is 1 —
    // so a radius in pixels is simply divided by the viewport height.
    uniforms.uLensRadius.value = lens.radius / window.innerHeight;

    this.composer.render();
  }
}
