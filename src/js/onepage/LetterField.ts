import * as THREE from "three";
import * as CANNON from "cannon-es";

import Commons from "../classes/Commons";
import Typography from "./Typography";
import { Phases } from "./Director";
import {
  COLORS,
  PILE_DEPTH,
  clamp01,
  contentWidth,
  easeOutExpo,
  lerp,
  nodeSurfaceY,
} from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  paragraphs: Array<string>;
}

interface Letter {
  mesh: THREE.Mesh;
  /** Assembled position. */
  home: THREE.Vector3;
  /** Where the letter flies in from. */
  origin: THREE.Vector3;
  /** Rotation it starts the flight with. */
  spin: THREE.Quaternion;
  /** Stagger of the fly-in, 0…1 of the assemble phase. */
  delay: number;
  /** Gravity progress at which this letter is let go. */
  release: number;
  /** Random phase for the idle wobble. */
  phase: number;
  halfExtents: CANNON.Vec3;
  mass: number;
  body: CANNON.Body | null;
}

/** Share of the assemble phase a single letter takes to arrive. */
const FLIGHT_SPAN = 0.45;

export default class LetterField {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private paragraphs: Array<string>;

  private group = new THREE.Group();
  private material: THREE.MeshStandardMaterial;
  private letters: Array<Letter> = [];

  private world: CANNON.World;
  private staticBodies: Array<CANNON.Body> = [];

  private released = 0;

  // Scratch objects, reused every frame to keep the loop allocation free.
  private scratchVector = new THREE.Vector3();
  private scratchQuaternion = new THREE.Quaternion();
  private identity = new THREE.Quaternion();

  constructor({ scene, typography, paragraphs }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;
    this.typography = typography;
    this.paragraphs = paragraphs;

    this.material = new THREE.MeshStandardMaterial({
      color: COLORS.paragraph,
      metalness: 0.14,
      roughness: 0.45,
      emissive: COLORS.accent.clone().multiplyScalar(0.06),
    });

    this.world = this.createWorld();
    this.createBounds();

    this.build();
    this.scene.add(this.group);
  }

  /* Setup
  --------------------------------------------------------- */

  private createWorld() {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -1600, 0) });

    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 8;

    world.defaultContactMaterial.friction = 0.42;
    world.defaultContactMaterial.restitution = 0.12;

    return world;
  }

  /**
   * The node surface plus invisible walls that keep the pile inside the 75%
   * content width and in a shallow slab, so nothing tumbles out of frame.
   */
  private createBounds() {
    this.staticBodies.forEach((body) => this.world.removeBody(body));
    this.staticBodies = [];

    const halfWidth = contentWidth() / 2;

    const planes: Array<{
      position: [number, number, number];
      axis: [number, number, number];
      angle: number;
    }> = [
      // Node surface.
      {
        position: [0, nodeSurfaceY(), 0],
        axis: [1, 0, 0],
        angle: -Math.PI / 2,
      },
      // Left and right walls.
      { position: [-halfWidth, 0, 0], axis: [0, 1, 0], angle: Math.PI / 2 },
      { position: [halfWidth, 0, 0], axis: [0, 1, 0], angle: -Math.PI / 2 },
      // Front and back walls.
      { position: [0, 0, -PILE_DEPTH], axis: [0, 1, 0], angle: 0 },
      { position: [0, 0, PILE_DEPTH], axis: [0, 1, 0], angle: Math.PI },
    ];

    planes.forEach(({ position, axis, angle }) => {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });

      body.position.set(...position);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle);

      this.world.addBody(body);
      this.staticBodies.push(body);
    });
  }

  private get fontSize() {
    return Math.min(34, Math.max(15, window.innerWidth * 0.0195));
  }

  private build() {
    const size = this.fontSize;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const layout = this.typography.layout(this.paragraphs, {
      size,
      maxWidth: contentWidth(),
      lineHeight: size * 1.55,
      blockGap: size * 1.35,
    });

    const blockY = height * 0.06;

    layout.chars.forEach((char, index) => {
      const glyph = this.typography.glyph(char.char, {
        size,
        depth: size * 0.3,
        bevel: false,
      });

      if (!glyph) return;

      const mesh = new THREE.Mesh(glyph.geometry, this.material);

      const home = new THREE.Vector3(
        char.x + glyph.offset.x,
        char.y + glyph.offset.y + blockY,
        0
      );

      mesh.position.copy(home);
      this.group.add(mesh);

      this.letters.push({
        mesh,
        home,
        origin: this.createOrigin(index, home, width, height),
        spin: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            (Math.random() - 0.5) * Math.PI * 2,
            (Math.random() - 0.5) * Math.PI * 2,
            (Math.random() - 0.5) * Math.PI * 2
          )
        ),
        delay: Math.random() * (1 - FLIGHT_SPAN),
        // Letters are let go roughly top line first, with a bit of noise.
        release:
          0.04 +
          (char.line / Math.max(1, layout.lines)) * 0.5 +
          Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2,
        halfExtents: new CANNON.Vec3(
          Math.max(2, (glyph.size.x / 2) * 0.92),
          Math.max(2, (glyph.size.y / 2) * 0.92),
          Math.max(2, glyph.size.z / 2)
        ),
        mass: Math.max(0.35, (glyph.size.x * glyph.size.y) / 900),
        body: null,
      });
    });
  }

  /** Every letter comes in from a different side of the viewport. */
  private createOrigin(
    index: number,
    home: THREE.Vector3,
    width: number,
    height: number
  ) {
    const random = (amount: number) => (Math.random() - 0.5) * amount;
    const side = index % 4;

    const origin = new THREE.Vector3(0, 0, random(900));

    switch (side) {
      case 0: // From the left.
        origin.set(-width * 0.75 - Math.random() * width * 0.5, home.y + random(height), origin.z);
        break;
      case 1: // From the right.
        origin.set(width * 0.75 + Math.random() * width * 0.5, home.y + random(height), origin.z);
        break;
      case 2: // From the top.
        origin.set(home.x + random(width), height * 0.8 + Math.random() * height * 0.6, origin.z);
        break;
      default: // From the bottom.
        origin.set(home.x + random(width), -height * 0.8 - Math.random() * height * 0.6, origin.z);
        break;
    }

    return origin;
  }

  private clear() {
    this.letters.forEach((letter) => {
      if (letter.body) this.world.removeBody(letter.body);
      this.group.remove(letter.mesh);
    });

    this.letters = [];
    this.released = 0;
  }

  onResize() {
    this.createBounds();

    // Rebuilding mid-fall would throw the pile away, so the layout is only
    // recalculated while the letters are still under our control.
    if (this.released > 0) return;

    this.clear();
    this.build();
  }

  /* Physics
  --------------------------------------------------------- */

  private releaseLetter(letter: Letter, haptic: number) {
    const { mesh } = letter;

    const body = new CANNON.Body({
      mass: letter.mass,
      shape: new CANNON.Box(letter.halfExtents),
    });

    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w
    );

    // The kick scales with how hard the page is being scrolled — that's the
    // haptic part: flick the wheel and the letters are ripped off the line.
    body.velocity.set(
      (Math.random() - 0.5) * (60 + haptic * 260),
      -40 - haptic * 320 - Math.random() * 60,
      (Math.random() - 0.5) * 70
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * (3 + haptic * 9),
      (Math.random() - 0.5) * (3 + haptic * 9),
      (Math.random() - 0.5) * (3 + haptic * 9)
    );

    body.linearDamping = 0.02;
    body.angularDamping = 0.08;
    body.allowSleep = true;
    body.sleepSpeedLimit = 14;
    body.sleepTimeLimit = 0.5;

    this.world.addBody(body);

    letter.body = body;
    this.released++;
  }

  private reset() {
    this.letters.forEach((letter) => {
      if (!letter.body) return;

      this.world.removeBody(letter.body);
      letter.body = null;
    });

    this.released = 0;
  }

  /* Frame
  --------------------------------------------------------- */

  update(phases: Phases, delta: number) {
    const { gravity, hold, velocity } = phases;

    // Scrolling into the gravity section always finds the text fully assembled,
    // even if the previous section was skipped in one flick.
    const assemble = gravity > 0 ? 1 : phases.assemble;

    const time = this.commons.elapsedTime;
    const haptic = Math.min(Math.abs(velocity) / 35, 1.6);

    if (gravity <= 0 && this.released > 0) this.reset();

    // Gravity itself reacts to the scroll: slow scrolling lets the letters
    // float down, a fast flick slams them onto the node.
    this.world.gravity.y = -(1100 + haptic * 2400);

    this.letters.forEach((letter) => {
      if (!letter.body && gravity > letter.release) {
        this.releaseLetter(letter, haptic);
      }
    });

    if (this.released > 0) {
      this.world.step(1 / 60, Math.min(delta, 1 / 20), 4);
    }

    this.letters.forEach((letter) => {
      const { mesh, body } = letter;

      if (body) {
        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w
        );
        mesh.scale.setScalar(1);
        return;
      }

      const flight = clamp01((assemble - letter.delay) / FLIGHT_SPAN);
      const eased = easeOutExpo(flight);

      // Two kinds of idle motion: while a letter is still out there it drifts on
      // its own random phase, once it has landed the whole block breathes as one
      // wave — otherwise the letter spacing would look ragged.
      const drift = 1 - eased;
      const settled = eased;
      const wave = time * 1.1 + letter.home.x * 0.011;

      this.scratchVector.copy(letter.origin).lerp(letter.home, eased);

      mesh.position.set(
        this.scratchVector.x + Math.sin(time * 0.7 + letter.phase) * 26 * drift,
        this.scratchVector.y +
          Math.cos(time * 0.6 + letter.phase) * 22 * drift +
          Math.sin(wave) * 3.5 * settled,
        this.scratchVector.z +
          Math.sin(time * 0.9 + letter.phase) * 40 * drift +
          Math.sin(wave * 0.8) * 14 * settled
      );

      this.scratchQuaternion.copy(letter.spin).slerp(this.identity, eased);
      mesh.quaternion.copy(this.scratchQuaternion);
      mesh.rotateZ(
        Math.sin(time * 0.8 + letter.phase) * 0.05 * drift +
          Math.sin(wave) * 0.02 * settled
      );

      mesh.scale.setScalar(lerp(0.55, 1, eased));
    });

    this.group.visible = hold > 0 || this.released > 0;
  }

  get progress() {
    return this.letters.length ? this.released / this.letters.length : 0;
  }
}
