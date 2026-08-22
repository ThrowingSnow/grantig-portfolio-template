import * as THREE from "three";

import CameraRig from "./CameraRig";
import Commons from "../classes/Commons";
import Typography from "./Typography";
import { Phases } from "./Director";
import { COLORS, TUNE, clamp01, smoothstep } from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  rig: CameraRig;
  words: Array<string>;
}

interface Gate {
  group: THREE.Group;
  /** Where on the ride it stands, 0…1. */
  at: number;
}

/** Fog bounds for the second level, in world units along the path. */
const FOG = { near: 700, far: 3400 };

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The second level: a run of word gates strung along the camera's path.
 *
 * Three things make it a different place rather than another section. It has
 * its own typeface — Gentilis rather than the Helvetiker the whole page above
 * is set in, so the letterforms themselves change. It inverts: pale ground,
 * dark ink. And it is laid out along a curve in world space instead of in
 * screen pixels, because by the time it is on screen the camera is moving and
 * the page's pixel convention no longer holds.
 *
 * Each gate is turned to face back up the path, so a word arrives square to the
 * lens and then swings past as the curve carries the camera through it.
 */
export default class DriftText {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private rig: CameraRig;
  private words: Array<string>;

  private group = new THREE.Group();
  private material: THREE.MeshStandardMaterial;
  private gates: Array<Gate> = [];

  /** Shared with the injected vertex code — one wave runs through every word. */
  private uniforms = {
    uTime: new THREE.Uniform(0),
    uMorph: new THREE.Uniform(0),
    uFrequency: new THREE.Uniform(0.01),
  };

  /** The palette the page above uses, to fade back to on the way out. */
  private ground = new THREE.Color();

  private scratch = new THREE.Vector3();
  private tangent = new THREE.Vector3();
  private side = new THREE.Vector3();

  constructor({ scene, typography, rig, words }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;
    this.typography = typography;
    this.rig = rig;
    this.words = words;

    this.material = this.createMaterial();

    this.build();

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * Standard lighting with a wave injected into it, rather than a shader of its
   * own: the level still wants the scene's lights on its letters, and rewriting
   * three's lighting to get a sine into `position` would be a bad trade.
   */
  private createMaterial() {
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.driftInk,
      metalness: 0.1,
      roughness: 0.55,
      emissive: COLORS.driftHot.clone().multiplyScalar(0.08),
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uMorph = this.uniforms.uMorph;
      shader.uniforms.uFrequency = this.uniforms.uFrequency;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uMorph;
           uniform float uFrequency;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // Two waves at different rates on different axes: one alone reads as
           // a flag, two crossing read as the letter itself coming apart.
           float wave = sin(transformed.y * uFrequency + uTime * 1.4)
                      + sin(transformed.x * uFrequency * 0.7 - uTime * 0.9) * 0.6;
           transformed.x += wave * uMorph;
           transformed.z += sin(transformed.x * uFrequency * 1.3 + uTime) * uMorph * 0.8;`
        );
    };

    return material;
  }

  private build() {
    const size = TUNE.drift.size;
    const start = this.rig.crossing;

    this.words.forEach((word, index) => {
      const group = new THREE.Group();

      // Spread over what is left of the path after the crossing, with a gap at
      // each end so the first word is not already past and the last one lands
      // before the path runs out.
      const at =
        start + ((index + 0.9) / (this.words.length + 0.8)) * (1 - start);

      const width = this.typography.measure(word, size);
      let x = -width / 2;

      for (const char of word) {
        const glyph = this.typography.glyph(char, {
          size,
          depth: size * 0.22,
          bevel: false,
        });

        if (glyph) {
          const mesh = new THREE.Mesh(glyph.geometry, this.material);
          mesh.position.set(x + glyph.offset.x, glyph.offset.y, 0);
          group.add(mesh);
        }

        x += this.typography.advance(char, size);
      }

      this.place(group, at, index);

      this.group.add(group);
      this.gates.push({ group, at });
    });
  }

  /** Stands a gate on the path, off to one side of it. */
  private place(group: THREE.Group, at: number, index: number) {
    this.rig.pointAt(at, this.scratch);
    this.rig.tangentAt(at, this.tangent);

    // Alternating sides, so the ride is a slalom past the words rather than a
    // straight run through the middle of all of them.
    this.side.crossVectors(this.tangent, UP).normalize();

    const lean = index % 2 === 0 ? 1 : -1;

    group.position
      .copy(this.scratch)
      .addScaledVector(this.side, lean * TUNE.drift.offset)
      .addScaledVector(UP, lean * TUNE.drift.offset * 0.3);
  }

  /**
   * Turning each word to face the lens, every frame, around the world's up axis
   * only.
   *
   * A fixed orientation was the obvious thing to do and it was wrong: this path
   * swings through more than a right angle between one word and the next, so a
   * gate aimed back down its own tangent is seen edge-on — or from behind, with
   * the type running backwards — from anywhere else on the ride. Keeping them
   * turned costs five `lookAt`s a frame and buys a level whose words can always
   * be read. They still lean and slide past; that comes from the camera's own
   * roll and from the wave, not from their footing.
   */
  private face() {
    const camera = this.commons.camera;

    this.gates.forEach(({ group }) => {
      // The camera's position flattened onto the word's own height, so the
      // letters stay standing instead of tipping over to look up at it.
      this.scratch.set(camera.position.x, group.position.y, camera.position.z);
      group.lookAt(this.scratch);
    });
  }

  onResize() {
    this.rebuild();
  }

  /** Word size and stand-off are read while building, so the panel can rebuild. */
  rebuild() {
    this.gates.forEach(({ group }) => this.group.remove(group));
    this.gates = [];
    this.build();
  }

  update(phases: Phases) {
    const { flip, drift, velocity } = phases;

    const presence = clamp01(Math.max(smoothstep(0.15, 1, flip), drift));

    this.group.visible = presence > 0.001;
    this.paint(presence);

    if (!this.group.visible) return;

    this.face();

    this.uniforms.uTime.value = this.commons.elapsedTime;
    this.uniforms.uFrequency.value = TUNE.drift.frequency;

    // The wave is scroll-driven like everything else on the page: standing
    // still the words settle, and a hard flick chews them up.
    this.uniforms.uMorph.value =
      TUNE.drift.morph * presence * (0.25 + clamp01(Math.abs(velocity) / 32));
  }

  /**
   * The inversion. Both the clear colour and the fog have to travel together —
   * fog left at the old colour turns the pale level into a black tunnel at
   * exactly the distance the words are standing.
   */
  private paint(presence: number) {
    const fog = this.scene.fog as THREE.Fog | null;

    this.ground.copy(COLORS.background).lerp(COLORS.drift, presence);

    (this.scene.background as THREE.Color).copy(this.ground);

    if (!fog) return;

    fog.color.copy(this.ground);
    fog.near = 900 + (FOG.near - 900) * presence;
    fog.far = 2600 + (FOG.far - 2600) * presence;
  }
}
