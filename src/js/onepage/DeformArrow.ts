import * as THREE from "three";
import { TessellateModifier } from "three/examples/jsm/Addons.js";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import { COLORS, TUNE, clamp01, lerp, smoothstep } from "./settings";

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

/** Half the arrow's length, in the units the shape is built at. */
const ARROW_REACH = 95;

/** How far outside the viewport it starts and ends its run, in pixels. */
const SWEEP_MARGIN = 520;

/** The core layer's colour above the crossing, where the ground is black. */
const CORE_LIGHT = new THREE.Color("#f4f1e8");

const TAU = Math.PI * 2;

/** How far the weave is kept off the camera's clipping planes, in pixels. */
const CLIP_MARGIN = 120;

/**
 * The scroll arrow in the middle of the page.
 * It borrows the deformation language of the codrops demo: a velocity driven
 * wave distortion plus an RGB split — except here the wave runs through the
 * geometry itself and the split is done with three additive layers.
 *
 * It has a second job at the end of the story: once the sphere has left and the
 * new line stands, the arrow comes in from one side and clears it away again.
 *
 * And a third. After that run it curves back into the middle of the frame and
 * stays there for the whole second level — see `escort()`, which is where the
 * page turns itself inside out and starts moving the world instead.
 */
export default class DeformArrow {
  private commons: Commons;
  private scene: THREE.Scene;

  private group = new THREE.Group();
  private geometry!: THREE.ExtrudeGeometry;
  private layers: Array<Layer> = [];

  /** Scale for the current viewport, before the run makes it bigger. */
  private baseScale = 1;

  /** +1 travelling right, -1 travelling left. 0 until a run picks a side. */
  private heading = 0;
  /** World x of the arrow's tip while it is running. */
  private tip = 0;

  /** True while it is dressed for the pale ground of the second level. */
  private inverted = false;

  /** Reused for the camera-space placement, so the escort allocates nothing. */
  private local = new THREE.Vector3();

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
        { color: CORE_LIGHT, shift: 0, opacity: 1 },
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
    this.baseScale = clamp01(window.innerWidth / 1440) * 0.6 + 0.75;
    this.group.scale.setScalar(this.baseScale);
  }

  /** Which way the current run is going: +1 to the right, -1 to the left. */
  get direction() {
    return this.heading;
  }

  /** Where its point is right now — what the letters are tested against. */
  get edge() {
    return this.tip;
  }

  /**
   * `armed` is false until the sphere has been clicked: without a line standing
   * there the run has nothing to clear, and an arrow tearing through an empty
   * frame reads as a bug rather than as a beat.
   */
  update(phases: Phases, armed = false) {
    const { hero, hold, charge, assemble, sweep, flip, velocity } = phases;
    const time = this.commons.elapsedTime;

    // Past the crossing the arrow is placed against the camera instead of
    // against the viewport, and that cannot be done until the rig has moved
    // this frame — so `escort()` takes over and this leaves the group alone.
    if (flip > 0) return;

    if (sweep > 0 && armed) {
      this.run(sweep, velocity, time);
      return;
    }

    // Rewound past the run: the next one is free to come from either side.
    this.heading = 0;

    const fade = 1 - smoothstep(0, 0.55, assemble);
    this.group.visible = fade > 0.001;

    if (!this.group.visible) return;

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

  /**
   * The run through the finished line.
   *
   * Position is mapped straight off the scroll rather than played back on a
   * timer: the arrow is pushed through the text by the wheel, so how hard the
   * line is hit is the reader's decision. The side it comes in from is drawn
   * once per run — the same page twice is not the same shot twice.
   */
  private run(progress: number, velocity: number, time: number) {
    if (!this.heading) this.heading = Math.random() < 0.5 ? -1 : 1;

    const scale = this.baseScale * TUNE.sweep.scale;
    const span = window.innerWidth + SWEEP_MARGIN * 2;

    this.group.visible = true;
    this.group.scale.setScalar(scale);

    // Pointing the way it travels: the shape is built tip-down, so a quarter
    // turn in the heading's direction lays it on its side, point first.
    this.group.rotation.set(0, 0, (this.heading * Math.PI) / 2);
    this.group.position.set(
      this.heading * (progress - 0.5) * span,
      Math.sin(time * 2.1) * 5,
      140
    );

    this.tip = this.group.position.x + this.heading * ARROW_REACH * scale;

    this.layers.forEach(({ mesh, shift }) => {
      const uniforms = mesh.material.uniforms;

      uniforms.uTime.value = time;
      uniforms.uVelocity.value = velocity;
      // The fill charges up as it eats its way through the line.
      uniforms.uCharge.value = progress;
      uniforms.uOffset.value =
        shift * (6 + Math.abs(velocity) * 0.45 + progress * 16);
      uniforms.uOpacity.value = mesh.userData.baseOpacity as number;
    });
  }

  /**
   * The second level: the arrow stops travelling and the world starts.
   *
   * Everything above this point moves the arrow across a frame that stands
   * still. Here that is turned around — the arrow is pinned in front of the
   * lens and the camera's ride carries the level past it. It is the same object
   * doing the same thing either way; what changes is which of the two the
   * reader reads as moving, and that is the whole point of the crossing.
   *
   * The swing in `z` is what makes it play with the words rather than hang in
   * front of them: the gates stand off to the side of the path, so an arrow
   * whose distance from the lens crosses theirs dives behind one and comes back
   * out in front of the next without ever leaving the middle of the frame. Its
   * scale is divided back out by that distance, so the depth shows up as
   * occlusion only — it does not balloon on the way towards the lens.
   *
   * Must be called *after* the rig has moved, and takes the camera's matrix
   * into its own hands because nothing has rendered yet this frame.
   */
  escort(phases: Phases) {
    const { flip, drift, velocity } = phases;

    if (flip <= 0) {
      if (this.inverted) this.invert(false);
      return;
    }

    const { escort } = TUNE;
    const camera = this.commons.camera;
    const time = this.commons.elapsedTime;

    const arrival = clamp01(flip);
    const ride = clamp01(drift);

    // Where the run left it: off the side of the frame, lying point-first.
    const heading = this.heading || 1;
    const exitX = heading * (window.innerWidth / 2 + SWEEP_MARGIN);

    const angle = ride * TAU * escort.rate;
    const swing = Math.sin(angle);

    const settled = smoothstep(0, 1, arrival);

    const x = lerp(exitX, swing * escort.swing, settled);
    const y =
      lerp(0, -escort.drop + Math.sin(angle * 0.5) * escort.bob, settled) -
      Math.sin(Math.PI * arrival) * escort.arc;

    // Camera space looks down -z, so the distance in front of the lens is the
    // negated depth. A third of a turn out of step with the swing, so it is
    // deepest on the way through the middle rather than at the far ends.
    const distance = lerp(
      escort.entry,
      escort.depth + Math.sin(angle + Math.PI / 3) * escort.weave,
      settled
    );

    // Kept clear of the clipping planes: the weave is a slider, and a distance
    // short of `near` does not put the arrow close, it deletes it.
    const held = Math.min(
      Math.max(distance, camera.near + CLIP_MARGIN),
      camera.far - CLIP_MARGIN
    );

    /**
     * How much the lens magnifies at that distance. Everything about the arrow
     * is written in the page's pixels and then multiplied back out by this —
     * position as much as size, because perspective moves an offset as surely
     * as it grows a shape. Without it on the offsets the arrow leaves the frame
     * sideways every time the weave brings it close, which is exactly when it
     * is supposed to be filling the middle of it.
     */
    const perspective = held / this.commons.distanceFromCamera;

    this.local.set(x * perspective, y * perspective, -held);
    camera.updateMatrixWorld();
    this.group.position.copy(camera.localToWorld(this.local));

    // Square to the lens first, then turned in the lens's own frame: coming out
    // of the run lying on its side and settling to point the way it is going.
    this.group.quaternion.copy(camera.quaternion);
    this.group.rotateY(Math.sin(angle * 0.75) * escort.spin * settled);
    this.group.rotateZ(
      lerp((heading * Math.PI) / 2, -swing * escort.bank, settled)
    );

    this.group.visible = true;
    this.group.scale.setScalar(this.baseScale * escort.scale * perspective);

    // The ground goes pale under it during the crossing, and a near white arrow
    // on a near white ground is no arrow at all. The blending has to be thrown
    // at a point — a switch, not a dial — but the core's colour is a colour, so
    // it travels with the ground rather than popping halfway across.
    const inverted = arrival > 0.5;
    if (inverted !== this.inverted) this.invert(inverted);

    this.layers.forEach(({ mesh, shift }) => {
      const uniforms = mesh.material.uniforms;

      if (shift === 0) {
        uniforms.uColor.value.copy(CORE_LIGHT).lerp(COLORS.driftInk, settled);
      }

      uniforms.uTime.value = time;
      uniforms.uVelocity.value = velocity;
      uniforms.uCharge.value = 0.35 + ride * 0.65;
      uniforms.uOffset.value = shift * (6 + Math.abs(velocity) * 0.45 + ride * 12);
      uniforms.uOpacity.value = mesh.userData.baseOpacity as number;
    });
  }

  /**
   * Dresses the arrow for the level it is standing in.
   *
   * The fringes are additive above the crossing, which is what makes them glow
   * against the black. Additive light on a pale ground adds nothing, so below it
   * they are blended normally instead. Thrown once on the crossing rather than
   * per frame, because `needsUpdate` recompiles the material.
   *
   * The core's colour is set here too, but only as the restore: on the way down
   * `escort()` lerps it every frame, and this is what puts it back for the run
   * through the line if the reader scrolls up out of the second level again.
   */
  private invert(on: boolean) {
    this.inverted = on;

    this.layers.forEach(({ mesh, shift }) => {
      const material = mesh.material;

      if (shift === 0) {
        material.uniforms.uColor.value.copy(on ? COLORS.driftInk : CORE_LIGHT);
        return;
      }

      material.blending = on ? THREE.NormalBlending : THREE.AdditiveBlending;
      material.needsUpdate = true;
    });
  }
}
