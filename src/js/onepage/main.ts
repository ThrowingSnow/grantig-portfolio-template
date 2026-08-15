import * as THREE from "three";

import Commons from "../classes/Commons";

import BannerText from "./BannerText";
import ChargeMeter from "./ChargeMeter";
import DeformArrow from "./DeformArrow";
import Director from "./Director";
import LetterField from "./LetterField";
import NodePlatform from "./NodePlatform";
import Pointer from "./Pointer";
import PostFX from "./PostFX";
import Typography from "./Typography";

import { COLORS, FONT_URL } from "./settings";

/**
 * The copy lives in the DOM (visually hidden) so the page stays readable for
 * screen readers and crawlers — WebGL only draws what is written there.
 */
const readText = (element: Element | null) =>
  (element?.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase();

/**
 * Entry point of the one-pager.
 *
 * Scroll story:
 * 1. Banner    — five words as extruded 3D letters that react to the pointer.
 * 2. Hold      — the deforming arrow and a charge meter that grows out of the
 *                center until it spans the full 75% content width.
 * 3. Assemble  — once that value is reached the paragraphs fly in from every
 *                side of the viewport.
 * 4. Gravity   — the second scroll hands the letters over to cannon-es; they
 *                drop and pile up on the node in the lower 12.5% of the screen.
 */
class OnePage {
  private commons!: Commons;
  private scene!: THREE.Scene;
  private clock = new THREE.Clock();

  private pointer!: Pointer;
  private director!: Director;
  private typography!: Typography;

  private banner!: BannerText;
  private arrow!: DeformArrow;
  private meter!: ChargeMeter;
  private node!: NodePlatform;
  private letters!: LetterField;
  private postFX!: PostFX;

  private pointerLight!: THREE.PointLight;

  private hud: Record<string, HTMLElement | null> = {};

  constructor() {
    document.addEventListener("DOMContentLoaded", () => this.init());
  }

  private async init() {
    this.typography = await Typography.load(FONT_URL);

    this.commons = Commons.getInstance();
    this.commons.init();

    this.createScene();
    this.createLights();
    this.createContent();

    this.postFX = new PostFX({ scene: this.scene });

    this.hud = {
      phase: document.querySelector('[data-hud="phase"]'),
      value: document.querySelector('[data-hud="value"]'),
      meter: document.querySelector('[data-hud="meter"]'),
    };

    window.addEventListener("resize", this.onResize);

    document.body.classList.remove("loading");

    this.update();
  }

  private createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = COLORS.background.clone();
    this.scene.fog = new THREE.Fog(COLORS.background.getHex(), 900, 2600);
  }

  private createLights() {
    this.scene.add(new THREE.AmbientLight(0xa8b2d0, 1.6));

    const key = new THREE.DirectionalLight(0xfff3e2, 2.9);
    key.position.set(340, 620, 900);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(COLORS.cold.getHex(), 1.1);
    rim.position.set(-700, -260, -420);
    this.scene.add(rim);

    this.pointerLight = new THREE.PointLight(COLORS.accent.getHex(), 3.2, 2400, 1.4);
    this.pointerLight.position.set(0, 0, 420);
    this.scene.add(this.pointerLight);
  }

  private createContent() {
    const banner = readText(document.querySelector('[data-webgl="banner"]'));
    const paragraphs = Array.from(
      document.querySelectorAll('[data-webgl="paragraph"]')
    ).map(readText);

    this.pointer = new Pointer();
    this.director = new Director();

    this.banner = new BannerText({
      scene: this.scene,
      typography: this.typography,
      text: banner || "LOREM IPSUM DOLOR SIT AMET",
    });

    this.arrow = new DeformArrow({ scene: this.scene });
    this.meter = new ChargeMeter({ scene: this.scene });
    this.node = new NodePlatform({ scene: this.scene });

    this.letters = new LetterField({
      scene: this.scene,
      typography: this.typography,
      paragraphs: paragraphs.filter(Boolean),
    });
  }

  private updateHud(phase: string, value: number) {
    if (this.hud.phase && this.hud.phase.textContent !== phase) {
      this.hud.phase.textContent = phase;
    }

    if (this.hud.value) this.hud.value.textContent = value.toFixed(2);
    if (this.hud.meter) this.hud.meter.style.transform = `scaleX(${value})`;
  }

  private update = () => {
    const delta = this.clock.getDelta();

    this.commons.update();
    this.pointer.update();

    const phases = this.director.update();

    this.banner.update(this.pointer, phases.hero);
    this.arrow.update(phases);
    this.meter.update(phases);
    this.node.update(phases);
    this.letters.update(phases, delta);

    this.pointerLight.position.x = this.pointer.smooth.x;
    this.pointerLight.position.y = this.pointer.smooth.y;

    if (phases.gravity > 0) {
      this.updateHud("gravity", this.letters.progress);
    } else if (phases.assemble > 0) {
      this.updateHud("assemble", phases.assemble);
    } else if (phases.hold > 0) {
      this.updateHud("charge", phases.charge);
    } else {
      this.updateHud("banner", phases.hero);
    }

    this.postFX.update(phases.velocity);

    window.requestAnimationFrame(this.update);
  };

  private onResize = () => {
    this.commons.onResize();
    this.director.onResize();

    this.banner.onResize();
    this.arrow.onResize();
    this.node.onResize();
    this.letters.onResize();

    this.postFX.onResize();
  };
}

export default new OnePage();
