import * as THREE from "three";
import * as CANNON from "cannon-es";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import {
  COLORS,
  TUNE,
  clamp01,
  contentWidth,
  easeInOutCubic,
  nodeSurfaceY,
  smoothstep,
} from "./settings";

interface Props {
  scene: THREE.Scene;
  /** The physics world the letters live in — the gate is their floor. */
  world: CANNON.World;
}

interface Wing {
  /** Pivot at the outer end of the wing. */
  hinge: THREE.Group;
  /** Empty marker at the center of the collision plate, read every frame. */
  plate: THREE.Object3D;
  body: CANNON.Body;
  /** Previous world position, so a kinematic body gets a real velocity. */
  previous: THREE.Vector3;
  /** Previous opening angle, for the same reason. */
  previousAngle: number;
  /** -1 for the left wing, 1 for the right one. */
  side: number;
}

/** Half thickness of the collision plate. */
const PLATE_HALF = 6;

/**
 * The surface the letters come to rest on, sitting in the lower 12.5% of the
 * viewport and spanning the same 75% width as the text block — and the gate that
 * swings it open in the middle so the pile can fall through into the void.
 *
 * It owns both halves of the floor as kinematic bodies, so the pile really does
 * slide off the tilting plates instead of the floor being switched off.
 */
export default class SurfaceGate {
  private commons: Commons;
  private world: CANNON.World;

  private group = new THREE.Group();
  private wings: Array<Wing> = [];
  private bars: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> =
    [];
  private posts: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> =
    [];
  private core: THREE.Mesh<
    THREE.OctahedronGeometry,
    THREE.MeshBasicMaterial
  >;

  private attached = false;

  private scratch = new THREE.Vector3();
  private scratchQuaternion = new THREE.Quaternion();

  constructor({ scene, world }: Props) {
    this.commons = Commons.getInstance();
    this.world = world;

    const plane = new THREE.PlaneGeometry(1, 1);

    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(11, 0),
      new THREE.MeshBasicMaterial({
        color: COLORS.banner,
        transparent: true,
        wireframe: true,
      })
    );

    [-1, 1].forEach((side) => {
      const hinge = new THREE.Group();

      const bar = new THREE.Mesh(
        plane,
        new THREE.MeshBasicMaterial({ color: COLORS.node, transparent: true })
      );

      const plate = new THREE.Object3D();

      hinge.add(bar, plate);
      this.group.add(hinge);

      const post = new THREE.Mesh(
        plane,
        new THREE.MeshBasicMaterial({
          color: COLORS.node,
          transparent: true,
          opacity: 0.5,
        })
      );

      this.group.add(post);

      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        shape: new CANNON.Box(new CANNON.Vec3(1, PLATE_HALF, TUNE.surface.depth)),
      });

      this.bars.push(bar);
      this.posts.push(post);
      this.wings.push({
        hinge,
        plate,
        body,
        previous: new THREE.Vector3(),
        previousAngle: 0,
        side,
      });
    });

    this.group.add(this.core);
    scene.add(this.group);

    this.onResize();
    this.attach();
  }

  /* Layout
  --------------------------------------------------------- */

  onResize() {
    const width = contentWidth();
    const half = width / 2;

    this.group.position.y = nodeSurfaceY();

    this.wings.forEach((wing, index) => {
      const { side } = wing;

      wing.hinge.position.x = side * half;

      this.bars[index].scale.set(half, 2, 1);
      this.bars[index].position.x = -side * (half / 2);

      // The collision plate hangs just below the visible line, so the letters
      // come to rest exactly on the surface.
      wing.plate.position.set(-side * (half / 2), -PLATE_HALF, 0);

      const shape = wing.body.shapes[0] as CANNON.Box;

      shape.halfExtents.set(half / 2, PLATE_HALF, TUNE.surface.depth);
      shape.updateConvexPolyhedronRepresentation();
      shape.updateBoundingSphereRadius();
      wing.body.updateBoundingRadius();

      this.posts[index].position.set(side * half, -14, 0);
      this.posts[index].scale.set(2, 28, 1);
    });

    this.group.updateMatrixWorld(true);
    this.wings.forEach((wing) => {
      wing.plate.getWorldPosition(wing.previous);
    });
  }

  /* Physics
  --------------------------------------------------------- */

  private attach() {
    if (this.attached) return;

    this.wings.forEach((wing) => this.world.addBody(wing.body));
    this.attached = true;
  }

  private detach() {
    if (!this.attached) return;

    this.wings.forEach((wing) => this.world.removeBody(wing.body));
    this.attached = false;
  }

  /* Frame
  --------------------------------------------------------- */

  update(phases: Phases, delta: number) {
    const { assemble, gravity, split, orbit } = phases;

    // Fades in once the text is assembled, so it reads as the surface the
    // letters are about to fall onto, and is gone once the void has them.
    const reveal = smoothstep(0.6, 1, assemble);
    const fade = 1 - smoothstep(0.35, 0.9, orbit);
    const open = easeInOutCubic(clamp01(split));

    const angle = open * THREE.MathUtils.degToRad(TUNE.surface.gate);
    const step = Math.max(1 / 240, Math.min(delta, 1 / 20));

    this.wings.forEach((wing) => {
      wing.hinge.rotation.z = -wing.side * angle;
    });

    this.group.updateMatrixWorld(true);

    // Once the wings hang straight down there is nothing left to stand on, and
    // keeping them in the world would only put walls into the orbit.
    if (open > 0.92) this.detach();
    else this.attach();

    this.wings.forEach((wing) => {
      const { body, plate, previous } = wing;

      plate.getWorldPosition(this.scratch);
      plate.getWorldQuaternion(this.scratchQuaternion);

      // A kinematic body is only ever moved by hand, so it has to be told how
      // fast it moved — otherwise the pile does not get carried by the tilt.
      body.velocity.set(
        (this.scratch.x - previous.x) / step,
        (this.scratch.y - previous.y) / step,
        0
      );
      body.angularVelocity.set(
        0,
        0,
        (-wing.side * (angle - wing.previousAngle)) / step
      );

      body.position.set(this.scratch.x, this.scratch.y, this.scratch.z);
      body.quaternion.set(
        this.scratchQuaternion.x,
        this.scratchQuaternion.y,
        this.scratchQuaternion.z,
        this.scratchQuaternion.w
      );
      body.updateAABB();

      previous.copy(this.scratch);
      wing.previousAngle = angle;
    });

    this.group.visible = reveal * fade > 0.001;
    if (!this.group.visible) return;

    const time = this.commons.elapsedTime;
    const opacity = reveal * fade;
    const pulse = 0.6 + Math.sin(time * 2.4) * 0.15 + gravity * 0.3;

    this.bars.forEach((bar) => {
      bar.material.opacity = opacity * pulse;
    });

    this.posts.forEach((post) => {
      post.material.opacity = opacity * 0.45 * (1 - open);
    });

    // The marker in the middle is the seam: it flares up just before the gate
    // gives way and is torn apart with it.
    const seam = 1 - smoothstep(0, 0.35, split);

    this.core.material.opacity =
      opacity * (0.5 + gravity * 0.5) * (0.25 + seam * 0.75);
    this.core.rotation.y = time * 0.8;
    this.core.rotation.z = time * 0.45;
    this.core.scale.setScalar(
      1 + gravity * 0.35 + Math.sin(time * 3) * 0.05 + open * 2.4
    );
  }
}
