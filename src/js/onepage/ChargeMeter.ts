import * as THREE from "three";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import { COLORS, contentWidth, smoothstep } from "./settings";

interface Props {
  scene: THREE.Scene;
}

/**
 * The "value" the holding section is charging up.
 * A line that grows out of the center of the screen until it spans the full
 * 75% content width — the moment it is full, the letters are allowed to fly in.
 */
export default class ChargeMeter {
  private commons: Commons;
  private group = new THREE.Group();

  private bar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private track: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private caps: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> =
    [];

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();

    const geometry = new THREE.PlaneGeometry(1, 1);

    this.track = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: COLORS.paragraph,
        transparent: true,
        opacity: 0.12,
      })
    );

    this.bar = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: COLORS.accent,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    for (let i = 0; i < 2; i++) {
      this.caps.push(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: COLORS.banner,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
    }

    this.group.add(this.track, this.bar, ...this.caps);
    scene.add(this.group);
  }

  update(phases: Phases) {
    const { charge, assemble, hero } = phases;

    // Only relevant while the page is holding.
    const fade =
      smoothstep(0.45, 1, hero) * (1 - smoothstep(0.05, 0.45, assemble));

    this.group.visible = fade > 0.001;
    if (!this.group.visible) return;

    const width = contentWidth();
    const filled = Math.max(1, width * charge);
    const time = this.commons.elapsedTime;

    this.group.position.y = -window.innerHeight * 0.14;

    this.track.scale.set(width, 2, 1);
    this.track.material.opacity = 0.12 * fade;

    this.bar.scale.set(filled, charge >= 1 ? 8 : 5, 1);
    this.bar.material.opacity =
      fade * (0.75 + Math.sin(time * 6) * 0.1 + (charge >= 1 ? 0.25 : 0));

    this.caps.forEach((cap, index) => {
      const direction = index === 0 ? -1 : 1;

      cap.position.x = (direction * filled) / 2;
      cap.scale.set(3, 16 + charge * 26, 1);
      cap.material.opacity = fade * (0.5 + charge * 0.5);
    });
  }
}
