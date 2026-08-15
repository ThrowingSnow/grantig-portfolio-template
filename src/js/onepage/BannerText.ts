import * as THREE from "three";

import Commons from "../classes/Commons";
import Pointer from "./Pointer";
import Typography from "./Typography";
import {
  COLORS,
  clamp01,
  contentWidth,
  lerp,
  smoothstep,
} from "./settings";

interface Props {
  scene: THREE.Scene;
  typography: Typography;
  text: string;
}

interface Letter {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  home: THREE.Vector3;
  /** Current hover influence, eased per frame. */
  influence: number;
  hovered: number;
  phase: number;
}

/**
 * The banner headline: every character is a real extruded 3D mesh.
 * The letters react to the pointer twice — a soft magnetic falloff for
 * everything close to the cursor, and a sharper highlight for the glyph the
 * cursor is actually on top of (raycast).
 */
export default class BannerText {
  private commons: Commons;
  private scene: THREE.Scene;
  private typography: Typography;
  private text: string;

  private group = new THREE.Group();
  private letters: Array<Letter> = [];

  private raycaster = new THREE.Raycaster();
  private hovered: Letter | null = null;

  /** Radius of the magnetic hover falloff, in pixels. */
  private radius = 300;

  private exit = 0;

  constructor({ scene, typography, text }: Props) {
    this.commons = Commons.getInstance();
    this.scene = scene;
    this.typography = typography;
    this.text = text;

    this.build();
    this.scene.add(this.group);
  }

  /**
   * Picks the size at which the five words fill the 75% content column in
   * roughly two lines, whatever the viewport happens to be.
   */
  private get fontSize() {
    const target = (contentWidth() * 1.85) / this.typography.measure(this.text, 1);

    return Math.min(
      170,
      window.innerHeight * 0.22,
      Math.max(38, target)
    );
  }

  private build() {
    const size = this.fontSize;

    const layout = this.typography.layout([this.text], {
      size,
      maxWidth: contentWidth(),
      lineHeight: size * 1.34,
      blockGap: 0,
    });

    layout.chars.forEach((char, index) => {
      const glyph = this.typography.glyph(char.char, {
        size,
        depth: size * 0.34,
        bevel: true,
      });

      if (!glyph) return;

      const material = new THREE.MeshStandardMaterial({
        color: COLORS.banner.clone(),
        metalness: 0.62,
        roughness: 0.26,
        emissive: COLORS.accent.clone(),
        emissiveIntensity: 0,
        transparent: true,
      });

      const mesh = new THREE.Mesh(glyph.geometry, material);

      const home = new THREE.Vector3(
        char.x + glyph.offset.x,
        char.y + glyph.offset.y,
        0
      );

      mesh.position.copy(home);
      mesh.userData.index = index;

      this.group.add(mesh);

      this.letters.push({
        mesh,
        home,
        influence: 0,
        hovered: 0,
        phase: index * 0.35,
      });
    });
  }

  private clear() {
    this.letters.forEach(({ mesh }) => {
      this.group.remove(mesh);
      mesh.material.dispose();
    });
    this.letters = [];
    this.hovered = null;
  }

  onResize() {
    this.clear();
    this.build();
  }

  private raycast(pointer: Pointer) {
    if (!pointer.active || this.exit > 0.4) {
      this.hovered = null;
      return;
    }

    this.raycaster.setFromCamera(pointer.ndc, this.commons.camera);

    const hit = this.raycaster.intersectObjects(this.group.children, false)[0];

    this.hovered = hit
      ? this.letters[(hit.object as THREE.Mesh).userData.index as number] ?? null
      : null;
  }

  update(pointer: Pointer, hero: number) {
    // The banner leaves as soon as the first section is scrolled away.
    this.exit = smoothstep(0.05, 0.85, hero);
    this.group.visible = this.exit < 0.999;

    if (!this.group.visible) return;

    const time = this.commons.elapsedTime;

    this.raycast(pointer);

    // Whole-headline parallax: the group leans towards the cursor.
    this.group.rotation.y = lerp(
      this.group.rotation.y,
      pointer.tilt.x * 0.16,
      0.06
    );
    this.group.rotation.x = lerp(
      this.group.rotation.x,
      -pointer.tilt.y * 0.1,
      0.06
    );

    this.group.position.y = this.exit * window.innerHeight * 0.75;
    this.group.position.z = -this.exit * 520;

    this.letters.forEach((letter) => {
      const { mesh, home } = letter;

      const dx = pointer.smooth.x - home.x;
      const dy = pointer.smooth.y - home.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const target = pointer.active
        ? clamp01(1 - distance / this.radius) ** 2
        : 0;

      letter.influence = lerp(letter.influence, target, 0.12);
      letter.hovered = lerp(letter.hovered, this.hovered === letter ? 1 : 0, 0.14);

      const pop = letter.influence + letter.hovered * 0.85;

      // Idle breathing so the headline is never completely static.
      const idle = Math.sin(time * 1.1 + letter.phase) * 5;

      mesh.position.x = home.x - dx * 0.05 * pop;
      mesh.position.y = home.y + idle + pop * 18 - this.exit * 120;
      mesh.position.z = home.z + pop * 95;

      mesh.rotation.x = -(dy / this.radius) * pop * 0.55 + this.exit * 1.1;
      mesh.rotation.y = (dx / this.radius) * pop * 0.7;
      mesh.rotation.z = Math.sin(time * 0.6 + letter.phase) * 0.02;

      const scale = 1 + pop * 0.11 - this.exit * 0.25;
      mesh.scale.setScalar(Math.max(0.001, scale));

      mesh.material.emissiveIntensity = pop * 0.9;
      mesh.material.color
        .copy(COLORS.banner)
        .lerp(COLORS.bannerHot, letter.hovered * 0.55);
      mesh.material.opacity = 1 - this.exit;
    });
  }
}
