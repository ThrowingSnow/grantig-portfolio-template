import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  ShaderPass,
} from "three/examples/jsm/Addons.js";

import Commons from "../classes/Commons";

import fragmentShader from "../../shaders/onepage/post.frag";
import vertexShader from "../../shaders/onepage/post.vert";

interface Props {
  scene: THREE.Scene;
}

/**
 * Wave + RGB shift pass driven by the scroll velocity, with a vignette and a
 * touch of grain on top.
 */
export default class PostFX {
  private commons: Commons;
  private composer: EffectComposer;
  private shiftPass: ShaderPass;

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
      },
      vertexShader,
      fragmentShader,
    });

    this.composer.addPass(this.shiftPass);
  }

  onResize() {
    this.composer.setPixelRatio(this.commons.sizes.pixelRatio);
    this.composer.setSize(
      this.commons.sizes.screen.width,
      this.commons.sizes.screen.height
    );
  }

  update(velocity: number) {
    this.shiftPass.uniforms.uTime.value = this.commons.elapsedTime;
    this.shiftPass.uniforms.uVelocity.value = velocity;

    this.composer.render();
  }
}
