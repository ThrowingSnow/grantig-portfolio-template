import * as THREE from "three";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import { TUNE, clamp01, lerp } from "./settings";

/**
 * Share of the ride the crossing takes up. The camera has to be off its fixed
 * spot and pointing down the path before the second level begins, or the first
 * word would arrive while the frame is still square to the screen.
 */
const CROSSING = 0.18;

/**
 * The camera's ride through the second level.
 *
 * Up to here the page has held one convention above all others: the camera sits
 * at z = 1000 with a fov chosen so that one world unit is one CSS pixel, which
 * is what lets every other module lay itself out in pixels. This class is where
 * that convention ends — and that is the point. Nothing below can be positioned
 * in screen pixels any more, so the second level places its content on the path
 * instead of on the viewport.
 *
 * The curve starts exactly where the camera always stood, so at a ride of 0 the
 * rig is a no-op and the first eight panels behave as though it did not exist.
 */
export default class CameraRig {
  private commons: Commons;

  private path = new THREE.CurvePath<THREE.Vector3>();

  private position = new THREE.Vector3();
  private target = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  /** Where the ride currently is, 0…1 along the whole path. */
  private ride = 0;
  private roll = 0;

  constructor() {
    this.commons = Commons.getInstance();
    this.build();
  }

  /**
   * Three cubic Béziers end to end. Written out rather than generated because
   * the shape of this path *is* the choreography of the level — the swings are
   * where the horizon tilts and the words come at you from the side.
   */
  private build() {
    const home = new THREE.Vector3(0, 0, this.commons.distanceFromCamera);

    const points: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
      [
        new THREE.Vector3(0, 0, 420),
        new THREE.Vector3(-760, 240, 60),
        new THREE.Vector3(-920, 300, -420),
      ],
      [
        new THREE.Vector3(-1120, 380, -980),
        new THREE.Vector3(700, -280, -1220),
        new THREE.Vector3(940, -340, -1740),
      ],
      [
        new THREE.Vector3(1180, -390, -2180),
        new THREE.Vector3(-240, 460, -2620),
        new THREE.Vector3(0, 220, -3200),
      ],
    ];

    let from = home;

    for (const [c1, c2, to] of points) {
      this.path.add(new THREE.CubicBezierCurve3(from, c1, c2, to));
      from = to;
    }
  }

  /** A point on the path, for anything that has to stand along the ride. */
  pointAt(t: number, out = new THREE.Vector3()) {
    return this.path.getPointAt(clamp01(t), out);
  }

  /** Which way the ride is heading there — what a word has to face. */
  tangentAt(t: number, out = new THREE.Vector3()) {
    return this.path.getTangentAt(clamp01(t), out);
  }

  /** Where the crossing ends and the level proper starts, in path units. */
  get crossing() {
    return CROSSING;
  }

  update(phases: Phases, delta: number) {
    const { flip, drift, velocity } = phases;

    // One continuous parameter out of two panels: the crossing is the first
    // slice of the path, the level itself is the rest.
    this.ride = clamp01(flip) * CROSSING + clamp01(drift) * (1 - CROSSING);

    const camera = this.commons.camera;

    if (this.ride <= 0) {
      // Above the crossing nothing has moved, so put the camera back exactly
      // where the rest of the page expects to find it and leave it alone.
      camera.position.set(0, 0, this.commons.distanceFromCamera);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      this.roll = 0;
      return;
    }

    this.pointAt(this.ride, this.position);
    this.pointAt(Math.min(1, this.ride + TUNE.drift.lead), this.target);

    // Looking dead ahead down a curve gives a flat, gliding shot. Rolling with
    // how hard the path is turning is what makes it read as being carried.
    const turn = this.target.x - this.position.x;
    const wanted = clamp01(Math.abs(velocity) / 40) * 0.35 + turn * 0.00042;

    this.roll = lerp(this.roll, wanted * TUNE.drift.roll, Math.min(1, delta * 2));
    this.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);

    camera.position.copy(this.position);
    camera.up.copy(this.up);
    camera.lookAt(this.target);
  }
}
