import * as THREE from "three";

import Commons from "../classes/Commons";
import { Phases } from "./Director";
import { COLORS, contentWidth, nodeSurfaceY, smoothstep } from "./settings";

interface Props {
  scene: THREE.Scene;
}

/**
 * The node the letters come to rest on, sitting in the lower 12.5% of the
 * viewport and spanning the same 75% width as the text block.
 */
export default class NodePlatform {
  private commons: Commons;
  private group = new THREE.Group();

  private bar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  private posts: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> =
    [];

  constructor({ scene }: Props) {
    this.commons = Commons.getInstance();

    const plane = new THREE.PlaneGeometry(1, 1);

    this.bar = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({ color: COLORS.node, transparent: true })
    );

    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(11, 0),
      new THREE.MeshBasicMaterial({
        color: COLORS.banner,
        transparent: true,
        wireframe: true,
      })
    );

    for (let i = 0; i < 2; i++) {
      this.posts.push(
        new THREE.Mesh(
          plane,
          new THREE.MeshBasicMaterial({
            color: COLORS.node,
            transparent: true,
            opacity: 0.5,
          })
        )
      );
    }

    this.group.add(this.bar, this.core, ...this.posts);
    scene.add(this.group);

    this.onResize();
  }

  onResize() {
    const width = contentWidth();

    this.group.position.y = nodeSurfaceY();

    this.bar.scale.set(width, 2, 1);

    this.posts.forEach((post, index) => {
      post.position.x = ((index === 0 ? -1 : 1) * width) / 2;
      post.position.y = -14;
      post.scale.set(2, 28, 1);
    });
  }

  update(phases: Phases) {
    const { assemble, gravity } = phases;

    // Fades in once the text is assembled, so it reads as the surface the
    // letters are about to fall onto.
    const reveal = smoothstep(0.6, 1, assemble);

    this.group.visible = reveal > 0.001;
    if (!this.group.visible) return;

    const time = this.commons.elapsedTime;
    const pulse = 0.6 + Math.sin(time * 2.4) * 0.15 + gravity * 0.3;

    this.bar.material.opacity = reveal * pulse;
    this.core.material.opacity = reveal * (0.5 + gravity * 0.5);
    this.core.rotation.y = time * 0.8;
    this.core.rotation.z = time * 0.45;
    this.core.scale.setScalar(1 + gravity * 0.35 + Math.sin(time * 3) * 0.05);

    this.posts.forEach((post) => {
      post.material.opacity = reveal * 0.45;
    });
  }
}
