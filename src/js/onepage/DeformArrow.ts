import * as THREE from "three";
import { TessellateModifier } from "three/examples/jsm/Addons.js";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import { COLORS, clamp01, lerp, smoothstep } from "./settings";

import fragmentShader from "../../shaders/onepage/arrow.frag";
import vertexShader from "../../shaders/onepage/arrow.vert";

interface Props {
  scene: THREE.Scene;
}

interface Layer {
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.ShaderMaterial>;
  /** How strongly this layer is pushed aside by the scroll velocity. */
  shift: number;
}

/**
 * The scroll arrow in the middle of the page.
 * It borrows the deformation language of the codrops demo: a velocity driven
 * wave distortion plus an RGB split — except here the wave runs through the
 * geometry itself and the split is done with three additive layers.
 */
export default class DeformArrow {
  private commons: Commons;
  private scene: THREE.Scene;

  private group = new THREE.Group();
  private geometry!: THREE.ExtrudeGeometry;
  private layers: Array<Layer> = [];

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;

    this.createGeometry();
    this.createLayers();

    this.scene.add(this.group);
    this.onResize();
  }

  private createGeometry() {
    const height = 190;
    const shaft = 24;
    const head = 96;
    const headHeight = 78;

    const top = height / 2;
    const bottom = -height / 2;
    const shoulder = bottom + headHeight;

    const shape = new THREE.Shape();
    shape.moveTo(-shaft / 2, top);
    shape.lineTo(shaft / 2, top);
    shape.lineTo(shaft / 2, shoulder);
    shape.lineTo(head / 2, shoulder);
    shape.lineTo(0, bottom);
    shape.lineTo(-head / 2, shoulder);
    shape.lineTo(-shaft / 2, shoulder);
    shape.closePath();

    // A zero-sized bevel keeps the shape flat but makes ExtrudeGeometry emit the
    // front and back caps — without it the arrow is just an outline.
    this.geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 18,
      bevelEnabled: true,
      bevelThickness: 0,
      bevelSize: 0,
      bevelOffset: 0,
      bevelSegments: 1,
    });

    // Subdividing the faces gives the wave in the vertex shader something to
    // actually bend — otherwise only the seven corners would move.
    this.geometry = new TessellateModifier(9, 6).modify(
      this.geometry
    ) as THREE.ExtrudeGeometry;

    this.geometry.center();
    this.normalizeUvs();
  }

  /**
   * ExtrudeGeometry writes raw x/y coordinates into the uv attribute, which is
   * useless for gradients — remap them into 0…1 over the arrow's bounds.
   */
  private normalizeUvs() {
    this.geometry.computeBoundingBox();

    const box = this.geometry.boundingBox as THREE.Box3;
    const size = box.getSize(new THREE.Vector3());

    const position = this.geometry.attributes.position;
    const uv = this.geometry.attributes.uv;

    for (let i = 0; i < position.count; i++) {
      uv.setXY(
        i,
        (position.getX(i) - box.min.x) / size.x,
        (position.getY(i) - box.min.y) / size.y
      );
    }

    uv.needsUpdate = true;
  }

  private createLayers() {
    const layers: Array<{ color: THREE.Color; shift: number; opacity: number }> =
      [
        { color: COLORS.accent, shift: -1, opacity: 0.55 },
        { color: COLORS.cold, shift: 1, opacity: 0.55 },
        { color: new THREE.Color("#f4f1e8"), shift: 0, opacity: 1 },
      ];

    layers.forEach(({ color, shift, opacity }) => {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: shift === 0,
        blending: shift === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: {
          uTime: new THREE.Uniform(0),
          uVelocity: new THREE.Uniform(0),
          uCharge: new THREE.Uniform(0),
          uAmplitude: new THREE.Uniform(2.5),
          uOffset: new THREE.Uniform(0),
          uColor: new THREE.Uniform(color.clone()),
          uOpacity: new THREE.Uniform(opacity),
        },
      });

      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.userData.baseOpacity = opacity;

      this.group.add(mesh);
      this.layers.push({ mesh, shift });
    });
  }

  onResize() {
    const scale = clamp01(window.innerWidth / 1440) * 0.6 + 0.75;
    this.group.scale.setScalar(scale);
  }

  update(phases: Phases) {
    const { hero, hold, charge, assemble, velocity } = phases;

    const fade = 1 - smoothstep(0, 0.55, assemble);
    this.group.visible = fade > 0.001;

    if (!this.group.visible) return;

    const time = this.commons.elapsedTime;
    const height = window.innerHeight;

    // Travels from below the banner to the middle of the screen while the page
    // is holding, then pulses harder the closer the charge gets to its target.
    const heroY = -height * 0.25 - hero * height * 0.12;
    const holdY = height * 0.04;

    this.group.position.y =
      lerp(heroY, holdY, smoothstep(0.15, 0.9, hero + hold)) +
      Math.sin(time * 2.1) * (6 + charge * 14);

    this.group.rotation.z = Math.sin(time * 0.9) * 0.05 * (1 + charge);
    this.group.rotation.y = Math.sin(time * 0.7) * 0.35;

    this.layers.forEach(({ mesh, shift }) => {
      const uniforms = mesh.material.uniforms;

      uniforms.uTime.value = time;
      uniforms.uVelocity.value = velocity;
      uniforms.uCharge.value = charge;
      uniforms.uOffset.value = shift * (4 + Math.abs(velocity) * 0.45 + charge * 10);
      uniforms.uOpacity.value = (mesh.userData.baseOpacity as number) * fade;
    });
  }
}
