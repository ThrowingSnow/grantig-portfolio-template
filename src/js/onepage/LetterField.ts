import * as THREE from "three";
import * as CANNON from "cannon-es";

import Commons from "../classes/Commons";
import CoreText from "./CoreText";
import Typography from "./Typography";
import { Phases } from "./Director";
import {
  COLORS,
  TUNE,
  WELL,
  clamp01,
  contentWidth,
  easeOutExpo,
  lerp,
  smoothstep,
  sphereRadius,
} from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  paragraphs: Array<string>;
}

interface Letter {
  mesh: THREE.Mesh;
  /** The character it draws — this is what lets the next line recycle it. */
  char: string;
  /** Offset from the glyph's baseline origin to its center, at the built size. */
  offset: THREE.Vector3;
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
  /** Orbit radius in the void, in multiples of the sphere's radius. */
  orbitFactor: number;
  /** Axis the letter circles the sphere on. */
  orbitAxis: CANNON.Vec3;
  /** Tangential speed it settles on, in pixels per second. */
  orbitSpeed: number;
  /** Where the letter was standing when the sphere let go of it. */
  from: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  /** Scale it was drawn at then — the tow shrinks it away from there. */
  fromScale: number;
  /** Radians of z-spin it picks up while it is towed off. */
  tumble: number;
  /** Its orbit axis, as three.js wants it — the tow spirals around this. */
  swirlAxis: THREE.Vector3;
  /** False for a letter that was conjured for the new line and never left. */
  retreats: boolean;
  /**
   * Its baseline place in the new line, or null when that line has no use for
   * it — those are the ones the mass keeps.
   */
  targetBase: THREE.Vector2 | null;
  /** Scale it has to reach for the new line's glyph size. */
  targetScale: number;
  /** Stagger of the pop back in, 0…1 of the return window. */
  returnDelay: number;
  halfExtents: CANNON.Vec3;
  mass: number;
  body: CANNON.Body | null;
}

/** Share of the assemble phase a single letter takes to arrive. */
const FLIGHT_SPAN = 0.45;

/**
 * How far back the new line comes from, as a share of the sphere's travel. Far
 * enough to be invisible in the fog, close enough that the pop forward is a
 * move rather than a fade-in.
 */
const RETURN_DEPTH = 0.5;

export default class LetterField {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private paragraphs: Array<string>;

  private group = new THREE.Group();
  private material: THREE.MeshStandardMaterial;
  private letters: Array<Letter> = [];

  private physics: CANNON.World;
  /** The walls keeping the pile inside the content column. */
  private walls: Array<CANNON.Body> = [];
  /** Stand-in for the sphere, so the swarm cannot fall into it. */
  private horizon: CANNON.Body | null = null;

  private released = 0;

  /**
   * How much of the fall the sphere has taken over. Latched, because the letters
   * must not drop out of their orbit when the page is scrolled back up a little.
   */
  private wellLatch = 0;
  private well = 0;

  /** Glyph size the meshes were built at — the new line is scaled against it. */
  private builtSize = 0;

  private dispersing = false;
  private dispersed = 0;
  /** Set once the arrow has started running through the finished line. */
  private sweeping = false;
  /** Set once the discarded letters have been thrown away and need rebuilding. */
  private pruned = false;

  // Scratch objects, reused every frame to keep the loop allocation free.
  private scratchVector = new THREE.Vector3();
  private scratchQuaternion = new THREE.Quaternion();
  private identity = new THREE.Quaternion();

  private direction = new CANNON.Vec3();
  private tangent = new CANNON.Vec3();
  private force = new CANNON.Vec3();

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

    this.physics = this.createWorld();
    this.createWalls();

    this.build();
    this.scene.add(this.group);
  }

  /** The world the surface gate hangs its own bodies in. */
  get world() {
    return this.physics;
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
   * Invisible walls that keep the pile inside the 75% content width and in a
   * shallow slab, so nothing tumbles out of frame. The floor is not in here —
   * that is the surface gate, which has to be able to swing it away.
   */
  private createWalls() {
    if (this.walls.length) return;

    const halfWidth = contentWidth() / 2;

    const planes: Array<{
      position: [number, number, number];
      axis: [number, number, number];
      angle: number;
    }> = [
      // Left and right walls.
      { position: [-halfWidth, 0, 0], axis: [0, 1, 0], angle: Math.PI / 2 },
      { position: [halfWidth, 0, 0], axis: [0, 1, 0], angle: -Math.PI / 2 },
      // Front and back walls.
      { position: [0, 0, -TUNE.surface.depth], axis: [0, 1, 0], angle: 0 },
      { position: [0, 0, TUNE.surface.depth], axis: [0, 1, 0], angle: Math.PI },
    ];

    planes.forEach(({ position, axis, angle }) => {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });

      body.position.set(...position);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle);

      this.physics.addBody(body);
      this.walls.push(body);
    });
  }

  private clearWalls() {
    this.walls.forEach((body) => this.physics.removeBody(body));
    this.walls = [];
  }

  /** The sphere as the physics engine sees it: a plain static ball. */
  private createHorizon() {
    if (this.horizon) return;

    this.horizon = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(sphereRadius() * 1.04),
    });

    this.physics.addBody(this.horizon);
  }

  private clearHorizon() {
    if (!this.horizon) return;

    this.physics.removeBody(this.horizon);
    this.horizon = null;
  }

  private get fontSize() {
    return Math.min(34, Math.max(15, window.innerWidth * 0.0195));
  }

  private build() {
    const size = this.fontSize;
    this.builtSize = size;
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

      // Half the swarm circles the sphere the other way round.
      const spin = Math.random() < 0.5 ? -1 : 1;

      this.letters.push({
        mesh,
        char: char.char,
        offset: glyph.offset,
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
        orbitFactor: WELL.inner + Math.random() * WELL.spread,
        orbitAxis: new CANNON.Vec3(
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.5,
          spin * (0.85 + Math.random() * 0.15)
        ).unit(),
        orbitSpeed: WELL.speed * (0.7 + Math.random() * 0.7),
        from: new THREE.Vector3(),
        fromQuaternion: new THREE.Quaternion(),
        fromScale: 1,
        tumble: 0,
        swirlAxis: new THREE.Vector3(),
        retreats: true,
        targetBase: null,
        targetScale: 1,
        returnDelay: Math.random(),
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
      if (letter.body) this.physics.removeBody(letter.body);
      this.group.remove(letter.mesh);
    });

    this.letters = [];
    this.released = 0;
    this.pruned = false;
  }

  onResize() {
    if (this.horizon) {
      this.clearHorizon();
      this.createHorizon();
    }

    // Rebuilding mid-fall would throw the pile away, so the layout is only
    // recalculated while the letters are still under our control.
    if (this.released > 0) return;

    this.clearWalls();
    this.createWalls();

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

    this.physics.addBody(body);

    letter.body = body;
    this.released++;
  }

  /**
   * The sphere's pull. Not a 1/r² attraction: a radial spring onto each letter's
   * own orbit radius plus a tangential drive. Newton either throws the swarm out
   * of frame or drops it into the middle — this keeps it a readable swarm.
   */
  private applyWell() {
    const radius = sphereRadius();

    this.letters.forEach((letter) => {
      const body = letter.body;
      if (!body) return;

      // A letter that fell asleep on the pile has to be woken up, or it would
      // hang in mid-air while the rest of the swarm takes off.
      body.allowSleep = false;
      body.wakeUp();
      body.linearDamping = lerp(0.02, 0.5, this.well);

      const { position, velocity } = body;
      const distance = Math.max(
        1,
        Math.hypot(position.x, position.y, position.z)
      );

      this.direction.set(
        position.x / distance,
        position.y / distance,
        position.z / distance
      );

      // tangent = axis × direction
      const axis = letter.orbitAxis;
      this.tangent.set(
        axis.y * this.direction.z - axis.z * this.direction.y,
        axis.z * this.direction.x - axis.x * this.direction.z,
        axis.x * this.direction.y - axis.y * this.direction.x
      );
      this.tangent.normalize();

      const radial =
        (radius * letter.orbitFactor - distance) * WELL.radial;
      const drive =
        (letter.orbitSpeed - velocity.dot(this.tangent)) * WELL.drive;
      const slab = -position.z * WELL.slab - velocity.z * 0.6;

      this.force.set(
        this.direction.x * radial + this.tangent.x * drive,
        this.direction.y * radial + this.tangent.y * drive,
        this.direction.z * radial + this.tangent.z * drive + slab
      );

      this.force.scale(body.mass * this.well, this.force);
      body.applyForce(this.force);
    });
  }

  private reset() {
    this.letters.forEach((letter) => {
      if (!letter.body) return;

      this.physics.removeBody(letter.body);
      letter.body = null;
    });

    this.released = 0;
    this.wellLatch = 0;
    this.well = 0;

    // A hand-over rescales the meshes, conjures new ones and throws the unused
    // ones away, so once it has started there is nothing left to rewind — the
    // swarm is built from scratch before it can fall a second time.
    const spent = this.dispersing;

    this.dispersing = false;
    this.dispersed = 0;
    this.sweeping = false;

    this.clearHorizon();
    this.createWalls();

    if (spent) {
      this.clear();
      this.build();
    }
  }

  /* State
  --------------------------------------------------------- */

  /** True once the swarm is held by the sphere — the click is armed from here. */
  get captured() {
    return this.well > 0.85;
  }

  /** 0 → 1 while the mass leaves and the survivors reassemble. */
  get dispersal() {
    return this.dispersing ? this.dispersed : 0;
  }

  /**
   * Called when the sphere is clicked. The mass backs out of the scene and takes
   * the *whole* swarm with it — nothing is left hanging in the frame while the
   * sphere leaves. Once it is gone the new line pops back out of that depth.
   *
   * The meshes are reused across the two halves: the letter that comes back as
   * the E of the new line is the letter that was orbiting a moment ago, so no
   * glyph has to be extruded twice. Which mesh lands where does not matter any
   * more — they all pass through the same vanishing point on the way — so the
   * buckets are drained in order rather than matched by position.
   */
  disperse(core: CoreText) {
    if (this.dispersing) return;

    // Everything is handed over from where it stands right now.
    this.letters.forEach((letter) => {
      letter.from.copy(letter.mesh.position);
      letter.fromQuaternion.copy(letter.mesh.quaternion);
      letter.fromScale = letter.mesh.scale.x;
      letter.tumble = (Math.random() - 0.5) * 8;
      // The axis it was already circling on, so the tow continues the motion
      // it was in rather than replacing it with a new one.
      letter.swirlAxis
        .set(letter.orbitAxis.x, letter.orbitAxis.y, letter.orbitAxis.z)
        .normalize();
      letter.returnDelay = Math.random();
      letter.retreats = true;
      letter.targetBase = null;

      if (letter.body) {
        this.physics.removeBody(letter.body);
        letter.body = null;
      }
    });

    // One bucket per character, so a place in the new line only ever takes a
    // mesh that already draws the glyph it needs.
    const available = new Map<string, Array<Letter>>();

    this.letters.forEach((letter) => {
      const bucket = available.get(letter.char);
      if (bucket) bucket.push(letter);
      else available.set(letter.char, [letter]);
    });

    const scale = this.builtSize > 0 ? core.size / this.builtSize : 1;

    core.targets.forEach((target) => {
      const bucket = available.get(target.char);

      const letter =
        bucket && bucket.length ? bucket.pop() : this.spawnLetter(target.char);

      if (!letter) return;

      letter.targetBase = new THREE.Vector2(target.x, target.y);
      letter.targetScale = scale;
    });

    this.dispersing = true;
    this.dispersed = 0;
  }

  /**
   * A character the swarm has run out of. It has nothing to be towed away — it
   * simply arrives with the rest of the line, so copy needing letters the
   * paragraphs never had still composes. That is what makes the text swappable.
   */
  private spawnLetter(char: string): Letter | null {
    const glyph = this.typography.glyph(char, {
      size: this.builtSize,
      depth: this.builtSize * 0.3,
      bevel: false,
    });

    if (!glyph) return null;

    const mesh = new THREE.Mesh(glyph.geometry, this.material);
    mesh.scale.setScalar(0.0001);
    mesh.visible = false;
    this.group.add(mesh);

    const letter: Letter = {
      mesh,
      char,
      offset: glyph.offset,
      home: new THREE.Vector3(),
      origin: new THREE.Vector3(),
      spin: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * Math.PI,
          (Math.random() - 0.5) * Math.PI,
          (Math.random() - 0.5) * Math.PI
        )
      ),
      delay: 0,
      release: 0,
      phase: Math.random() * Math.PI * 2,
      orbitFactor: WELL.inner,
      orbitAxis: new CANNON.Vec3(0, 0, 1),
      orbitSpeed: WELL.speed,
      from: new THREE.Vector3(),
      fromQuaternion: new THREE.Quaternion(),
      fromScale: 0,
      tumble: 0,
      swirlAxis: new THREE.Vector3(0, 0, 1),
      retreats: false,
      targetBase: null,
      targetScale: 1,
      returnDelay: Math.random(),
      halfExtents: new CANNON.Vec3(1, 1, 1),
      mass: 1,
      body: null,
    };

    this.letters.push(letter);
    return letter;
  }

  /* Frame
  --------------------------------------------------------- */

  update(phases: Phases, delta: number) {
    const { gravity, hold, split, orbit, sweep, flip, velocity } = phases;

    // Scrolling into the gravity section always finds the text fully assembled,
    // even if the previous section was skipped in one flick.
    const assemble = gravity > 0 ? 1 : phases.assemble;

    const time = this.commons.elapsedTime;
    const haptic = Math.min(Math.abs(velocity) / 35, 1.6);

    if (gravity <= 0 && (this.released > 0 || this.wellLatch > 0)) this.reset();

    // The sphere takes over while the gate is swinging open, and keeps the swarm
    // once it has it.
    this.wellLatch = Math.max(
      this.wellLatch,
      Math.max(smoothstep(0.2, 0.85, split), orbit > 0 ? 1 : 0)
    );
    this.well += (this.wellLatch - this.well) * Math.min(1, delta * 2.2);

    // In the void there is nothing to bump into except the sphere — and once
    // the arrow is clearing the line there is not even that, so the stand-in
    // must not be put back underneath the debris.
    if (this.well > 0.05 && !this.sweeping) {
      this.clearWalls();
      this.createHorizon();
    }

    // Gravity itself reacts to the scroll: slow scrolling lets the letters float
    // down, a fast flick slams them onto the surface — until the well cancels it.
    this.physics.gravity.y =
      -(TUNE.fall.gravity + haptic * TUNE.fall.haptic) * (1 - this.well);

    // Not while the swarm is being handed over: `disperse()` takes every body
    // out of the world, and this would hand them all straight back.
    if (!this.dispersing) {
      this.letters.forEach((letter) => {
        if (!letter.body && gravity > letter.release) {
          this.releaseLetter(letter, haptic);
        }
      });
    }

    if (this.sweeping && sweep <= 0) this.unsweep();

    if (this.sweeping) {
      // The well let go the moment the arrow arrived, so the debris falls.
      this.physics.gravity.y = -TUNE.fall.gravity * TUNE.sweep.gravity;
      this.physics.step(1 / 60, Math.min(delta, 1 / 20), 4);
    } else if (this.dispersing) {
      this.dispersed = Math.min(1, this.dispersed + delta / TUNE.depart.time);
    } else if (this.released > 0) {
      if (this.well > 0.02) this.applyWell();
      this.physics.step(1 / 60, Math.min(delta, 1 / 20), 4);
    }

    this.letters.forEach((letter) => {
      const { mesh, body } = letter;

      // A body outranks everything: it is either falling onto the surface or
      // being swept out of the frame, and both are the engine's business now.
      if (body) {
        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w
        );
        mesh.scale.setScalar(letter.targetScale);
        return;
      }

      if (this.dispersing) {
        this.place(letter, time);
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

    // The group holds the new line now as well, so it stays on after the click.
    // Past the crossing nothing from the first level is shown at all.
    this.group.visible =
      flip <= 0 && (hold > 0 || this.released > 0 || this.dispersing);

    if (this.dispersing && this.dispersed >= 1 && !this.pruned) this.prune();
  }

  /**
   * Where a letter stands during the hand-over.
   *
   * Two movements, back to back. Every letter is first towed after the sphere,
   * shrinking as it goes so it is *gone* rather than merely small — the frame
   * empties out completely. Then the ones the new line claimed pop forward out
   * of that same depth and ring out around their places, which is what sells
   * them as arriving rather than as fading in.
   */
  private place(letter: Letter, time: number) {
    const { mesh, from, targetBase } = letter;
    const t = this.dispersed;
    const overlap = clamp01(TUNE.core.overlap);

    // 1. The tow.
    const out = letter.retreats ? clamp01(t / Math.max(0.05, overlap)) : 1;

    if (out < 1) {
      // Accelerating, like the mass that is pulling them.
      const eased = out * out;

      // Still on its own orbit, only now the orbit is winding in: the letter is
      // carried further round the sphere the closer it gets, and the radius is
      // reeled in at the same time. That is what keeps the swarm looking like a
      // swarm on the way out instead of a formation flying backwards.
      this.scratchVector
        .copy(from)
        .applyAxisAngle(letter.swirlAxis, TUNE.depart.swirl * Math.PI * 2 * eased)
        .multiplyScalar(1 - TUNE.depart.pull * eased);

      mesh.visible = true;
      mesh.position.set(
        this.scratchVector.x,
        this.scratchVector.y,
        this.scratchVector.z - TUNE.depart.distance * eased
      );

      mesh.quaternion.copy(letter.fromQuaternion);
      mesh.rotateZ(letter.tumble * eased);
      mesh.scale.setScalar(Math.max(0.0001, letter.fromScale * (1 - eased)));
      return;
    }

    if (!targetBase) {
      mesh.visible = false;
      return;
    }

    // 2. The return, staggered so the line assembles in a scatter instead of
    //    materialising as one block.
    const returnWindow = 1 - overlap;
    const span = Math.max(0.05, returnWindow * (1 - clamp01(TUNE.core.stagger)));
    const p = clamp01(
      (t - overlap - letter.returnDelay * returnWindow * clamp01(TUNE.core.stagger)) /
        span
    );

    if (p <= 0) {
      mesh.visible = false;
      return;
    }

    const eased = easeOutExpo(p);

    // Zero at both ends: the letter overshoots, rings out, and is properly
    // still by the time the hand-over is over.
    const ring = Math.sin(p * Math.PI * 3) * Math.exp(-p * 3.4);
    const wobble = TUNE.core.wobble * ring;

    const scale = letter.targetScale;
    const baseX = targetBase.x + letter.offset.x * scale;
    const baseY = targetBase.y + letter.offset.y * scale;

    mesh.visible = true;
    mesh.position.set(
      baseX +
        Math.cos(letter.phase) * wobble +
        Math.cos(time * 0.7 + letter.phase) * 2.4 * eased,
      baseY +
        Math.sin(letter.phase) * wobble +
        Math.sin(time * 0.8 + letter.phase) * 2.4 * eased,
      lerp(-TUNE.depart.distance * RETURN_DEPTH, 0, eased) + wobble * 1.6
    );

    this.scratchQuaternion.copy(letter.spin).slerp(this.identity, eased);
    mesh.quaternion.copy(this.scratchQuaternion);
    mesh.rotateZ(ring * 0.22 + Math.sin(time * 0.6 + letter.phase) * 0.02 * eased);

    mesh.scale.setScalar(Math.max(0.0001, scale * eased * (1 + ring * 0.18)));
  }

  /**
   * The arrow running through the finished line.
   *
   * Nothing is faded here: every letter the arrow's point has gone past is
   * handed back to the physics engine and struck, so what leaves the frame is
   * the same matter that arrived in it. The test is the tip's x alone — the
   * arrow is one shape crossing a block several rows tall, and asking each row
   * to wait its turn would read as the letters dodging rather than being hit.
   */
  sweep(edge: number, direction: number) {
    if (!this.dispersing || !direction) return;

    if (!this.sweeping) {
      this.sweeping = true;
      // The void has no floor and no sides, and the mass that was standing in
      // for the sphere is long gone. There is nothing left to hit.
      this.clearHorizon();
      this.clearWalls();
    }

    this.letters.forEach((letter) => {
      if (letter.body || !letter.targetBase) return;
      if (direction * (edge - letter.mesh.position.x) < 0) return;

      this.strike(letter, direction);
    });
  }

  /** Hands one letter back to the physics engine and kicks it out of frame. */
  private strike(letter: Letter, direction: number) {
    const { mesh } = letter;
    const scale = letter.targetScale;

    const body = new CANNON.Body({
      mass: letter.mass,
      shape: new CANNON.Box(
        new CANNON.Vec3(
          letter.halfExtents.x * scale,
          letter.halfExtents.y * scale,
          letter.halfExtents.z * scale
        )
      ),
    });

    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w
    );

    body.velocity.set(
      direction * TUNE.sweep.push * (0.7 + Math.random() * 0.6),
      TUNE.sweep.lift * (0.4 + Math.random()),
      (Math.random() - 0.5) * 260
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      -direction * (4 + Math.random() * 10)
    );

    body.linearDamping = 0.01;
    body.angularDamping = 0.03;
    body.allowSleep = false;

    this.physics.addBody(body);
    letter.body = body;
  }

  /** Scrolled back off the run: the line is put together again. */
  private unsweep() {
    this.letters.forEach((letter) => {
      if (!letter.body) return;

      this.physics.removeBody(letter.body);
      letter.body = null;
    });

    this.sweeping = false;
  }

  /** The debris is long out of frame — dropping it gives the frame budget back. */
  private prune() {
    this.letters = this.letters.filter((letter) => {
      if (letter.targetBase) return true;

      this.group.remove(letter.mesh);
      return false;
    });

    this.pruned = true;
  }

  get progress() {
    return this.letters.length ? this.released / this.letters.length : 0;
  }
}
