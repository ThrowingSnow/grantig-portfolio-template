import * as THREE from "three";

import Commons from "../classes/Commons";

import BannerText from "./BannerText";
import ChargeMeter from "./ChargeMeter";
import CameraRig from "./CameraRig";
import CoreText from "./CoreText";
import DeformArrow from "./DeformArrow";
import Director, { Phases } from "./Director";
import DriftText from "./DriftText";
import GravityGrid from "./GravityGrid";
import GravityWell from "./GravityWell";
import LetterField from "./LetterField";
import Pointer from "./Pointer";
import PostFX from "./PostFX";
import SurfaceGate from "./SurfaceGate";
import Typography from "./Typography";

import { COLORS, DRIFT_FONT_URL, FONT_URL, sphereRadius } from "./settings";
import { embedded, install, restore, restoreCopy } from "./tuning";

/**
 * The copy lives in the DOM (visually hidden) so the page stays readable for
 * screen readers and crawlers — WebGL only draws what is written there.
 */
/** The panels that only exist once the sphere has been clicked. */
const LOCKED = ["sweep", "flip", "drift"];

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
 *                drop and pile up on the surface in the lower 12.5% of the screen.
 * 5. Split     — the surface swings open in the middle and the pile slides off
 *                the two tilting halves.
 * 6. Orbit     — the letters fall into the void, where a black sphere catches
 *                them and holds them in orbit around itself.
 * 7. Core      — clicking the sphere sends it backwards out of the scene. It
 *                drags the swarm after it and keeps everything the next line
 *                has no use for; the letters that are needed are set down as
 *                that line, which straightens out as the mass disappears.
 *
 * 8. Sweep    — the arrow comes back in from a side drawn at random and knocks
 *                that line out of the frame.
 * 9. Crossing  — the ground goes pale and the camera leaves its fixed spot.
 * 10. Drift    — it rides a bezier past a run of words in a second typeface.
 *
 * Steps 8 to 10 are locked away until the sphere has been clicked: the panels
 * carrying them have no height until then, so the document ends at the sphere
 * and the wheel cannot get past it.
 */
class OnePage {
  private commons!: Commons;
  private scene!: THREE.Scene;
  private clock = new THREE.Clock();

  private pointer!: Pointer;
  private director!: Director;
  private typography!: Typography;
  private driftFace!: Typography;

  private banner!: BannerText;
  private arrow!: DeformArrow;
  private meter!: ChargeMeter;
  private gate!: SurfaceGate;
  private letters!: LetterField;
  private well!: GravityWell;
  private grid!: GravityGrid;
  private core!: CoreText;
  private rig!: CameraRig;
  private drift!: DriftText;
  private postFX!: PostFX;

  private pointerLight!: THREE.PointLight;

  private hud: Record<string, HTMLElement | null> = {};

  /** The DOM button sitting on top of the sphere — that's what gets clicked. */
  private trigger: HTMLButtonElement | null = null;
  private hovered = false;
  private collapsed = false;

  /** Carries `data-locked` — the second half of the page hangs off it. */
  private page: HTMLElement | null = null;

  constructor() {
    document.addEventListener("DOMContentLoaded", () => this.init());
  }

  private async init() {
    // Inside the config frame the scene starts from whatever is being tried out
    // there. Has to happen before anything reads a value out of `TUNE` or a
    // word out of the DOM.
    if (embedded()) {
      restore();
      restoreCopy();
    }

    // Both faces up front: the second level's words are built while the scene
    // is, so its first gate cannot pop in halfway through the crossing.
    const [typography, driftFace] = await Promise.all([
      Typography.load(FONT_URL),
      Typography.load(DRIFT_FONT_URL),
    ]);

    this.typography = typography;
    this.driftFace = driftFace;

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

    this.createTrigger();

    window.addEventListener("resize", this.onResize);

    if (embedded()) {
      install({ refresh: this.onResize, goTo: this.goTo });
    }

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
    const core = readText(document.querySelector('[data-webgl="core"]'));

    this.page = document.querySelector<HTMLElement>(".page");

    this.pointer = new Pointer();
    this.director = new Director();

    this.banner = new BannerText({
      scene: this.scene,
      typography: this.typography,
      text: banner || "LOREM IPSUM DOLOR SIT AMET",
    });

    this.arrow = new DeformArrow({ scene: this.scene });
    this.meter = new ChargeMeter({ scene: this.scene });

    this.letters = new LetterField({
      scene: this.scene,
      typography: this.typography,
      paragraphs: paragraphs.filter(Boolean),
    });

    // The gate is the letters' floor, so it hangs its halves in their world.
    this.gate = new SurfaceGate({
      scene: this.scene,
      world: this.letters.world,
    });

    this.grid = new GravityGrid({ scene: this.scene });
    this.well = new GravityWell({ scene: this.scene });

    // Owns no meshes: it works out where the line sits, and `LetterField` moves
    // the letters that were orbiting a moment ago into those places.
    this.core = new CoreText({
      typography: this.typography,
      text: core || "LOREM IPSUM DOLOR SIT AMET",
    });

    // The rig is where the page stops measuring itself in CSS pixels, so it is
    // built last: everything above has already laid itself out by then.
    this.rig = new CameraRig();

    this.drift = new DriftText({
      scene: this.scene,
      typography: this.driftFace,
      rig: this.rig,
      words: Array.from(document.querySelectorAll('[data-webgl="drift"]'))
        .map(readText)
        .filter(Boolean),
    });
  }

  /**
   * The sphere is clicked through a real button laid over it: that way the state
   * is reachable by keyboard, announced to screen readers and gets a cursor —
   * none of which a raycast would give us.
   */
  private createTrigger() {
    this.trigger = document.querySelector<HTMLButtonElement>(
      '[data-action="collapse"]'
    );

    this.syncTriggerSize();

    this.trigger?.addEventListener("click", this.onCollapse);
    this.trigger?.addEventListener("pointerenter", () => (this.hovered = true));
    this.trigger?.addEventListener("pointerleave", () => (this.hovered = false));
    this.trigger?.addEventListener("focus", () => (this.hovered = true));
    this.trigger?.addEventListener("blur", () => (this.hovered = false));
  }

  private syncTriggerSize() {
    document.documentElement.style.setProperty(
      "--sphere-size",
      `${Math.round(sphereRadius() * 2)}px`
    );
  }

  private onCollapse = () => {
    if (this.collapsed) return;

    this.collapsed = true;

    // The rest of the page exists from here on. It is added below the reader,
    // never around them: the locked document ends exactly where the sweep panel
    // starts, so nothing they can see moves.
    this.setLocked(false);

    this.well.depart();
    this.letters.disperse(this.core);
    this.postFX.glitch();

    // The button tears itself apart on the way out — same burst as the frame.
    this.trigger?.classList.add("sphere--fired");
    window.setTimeout(
      () => this.trigger?.classList.remove("sphere--fired"),
      600
    );
  };

  /**
   * Adds or removes the panels below the sphere. Both lenis and the director
   * hold a measurement of the document, and the document just changed length,
   * so both have to be told — otherwise the page can be scrolled into a region
   * one of them still thinks is somewhere else.
   */
  private setLocked(locked: boolean) {
    if (!this.page) return;
    if ((this.page.dataset.locked === "true") === locked) return;

    this.page.dataset.locked = String(locked);

    this.commons.lenis.resize();
    this.director.onResize();
  }

  /** Arms the button once the swarm is actually in orbit around the sphere. */
  private syncTrigger(phases: Phases) {
    const ready = !this.collapsed && this.letters.captured && phases.orbit > 0.4;

    this.well.hovered = this.hovered && ready;

    if (!this.trigger) return;

    // The button is laid over the sphere, so it has to leave with it.
    this.trigger.hidden = phases.flip > 0;

    if (this.trigger.disabled === ready) this.trigger.disabled = !ready;
    if ((this.trigger.dataset.ready === "true") !== ready) {
      this.trigger.dataset.ready = String(ready);
    }
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

    // Scrolled all the way back out of the fall: the void is rolled up with it.
    // The swarm and the sphere both put themselves back on their own, and the
    // second half is locked away again — the sphere is waiting to be clicked a
    // second time, so it has to be able to hold the reader a second time.
    if (phases.gravity <= 0 && this.collapsed) {
      this.collapsed = false;
      this.setLocked(true);
    }

    this.banner.update(this.pointer, phases.hero);
    this.arrow.update(phases, this.collapsed);
    this.meter.update(phases);

    // The arrow moves first, then the letters are asked what its point has
    // already gone past — the other way round they would be struck a frame late.
    if (phases.sweep > 0 && this.collapsed) {
      this.letters.sweep(this.arrow.edge, this.arrow.direction);
    }

    // The gate moves before the world is stepped, otherwise the pile would be
    // resolved against the halves' previous position.
    this.gate.update(phases, delta);
    this.letters.update(phases, delta);

    this.well.update(phases, delta);
    // The grid belongs to the void, and the void ends at the crossing.
    this.grid.update(phases.flip > 0 ? 0 : this.well.strength);

    // The rig moves first: the second level turns its words to face the lens,
    // so it has to be asked where the lens is *this* frame, not last frame.
    this.rig.update(phases, delta);
    this.drift.update(phases);

    // And the arrow last of all. From the crossing on it is placed against the
    // camera rather than against the viewport, so it has to be told where the
    // lens ended up this frame — the earlier `update()` hands over to this.
    this.arrow.escort(phases);

    this.syncTrigger(phases);

    this.pointerLight.position.x = this.pointer.smooth.x;
    this.pointerLight.position.y = this.pointer.smooth.y;

    if (phases.drift > 0) {
      this.updateHud("drift", phases.drift);
    } else if (phases.flip > 0) {
      this.updateHud("flip", phases.flip);
    } else if (phases.sweep > 0 && this.collapsed) {
      this.updateHud("sweep", phases.sweep);
    } else if (this.collapsed) {
      this.updateHud("core", this.letters.dispersal);
    } else if (phases.orbit > 0) {
      this.updateHud("orbit", phases.orbit);
    } else if (phases.split > 0) {
      this.updateHud("split", phases.split);
    } else if (phases.gravity > 0) {
      this.updateHud("gravity", this.letters.progress);
    } else if (phases.assemble > 0) {
      this.updateHud("assemble", phases.assemble);
    } else if (phases.hold > 0) {
      this.updateHud("charge", phases.charge);
    } else {
      this.updateHud("banner", phases.hero);
    }

    this.postFX.update(phases.velocity, {
      strength: this.well.strength,
      radius: this.well.screenRadius,
    });

    window.requestAnimationFrame(this.update);
  };

  /**
   * Jumps to a named panel, used by the config page to get to the phase a knob
   * is worth watching in. Goes through lenis, otherwise the smooth scroll would
   * immediately drag the page back.
   */
  private goTo = (panel: string, offset = 0.5) => {
    const element = document.querySelector<HTMLElement>(
      `[data-panel="${panel}"]`
    );

    if (!element) return;

    // The tuning page has to be able to look at the second level without
    // playing the whole story to get there.
    if (LOCKED.includes(panel)) this.setLocked(false);

    this.commons.lenis.scrollTo(element.offsetTop + element.offsetHeight * offset, {
      immediate: true,
    });
  };

  private onResize = () => {
    this.commons.onResize();
    this.director.onResize();

    this.banner.onResize();
    this.arrow.onResize();
    this.gate.onResize();
    this.letters.onResize();
    this.grid.onResize();
    this.well.onResize();
    this.core.onResize();
    this.drift.onResize();

    this.syncTriggerSize();

    this.postFX.onResize();
  };
}

export default new OnePage();
