import * as THREE from "three";
import { Font, FontLoader, TextGeometry } from "three/examples/jsm/Addons.js";

export interface Glyph {
  geometry: TextGeometry;
  /** Offset from the glyph's baseline origin to its geometric center. */
  offset: THREE.Vector3;
  size: THREE.Vector3;
}

export interface GlyphOptions {
  size: number;
  depth: number;
  bevel: boolean;
  curveSegments?: number;
}

export interface PlacedChar {
  char: string;
  /** Baseline-left position of the glyph, relative to the block's center. */
  x: number;
  y: number;
  /** Index of the paragraph this char belongs to. */
  block: number;
  /** Index of the line this char belongs to, counted over the whole layout. */
  line: number;
}

export interface Layout {
  chars: Array<PlacedChar>;
  width: number;
  height: number;
  lines: number;
}

export interface LayoutOptions {
  size: number;
  maxWidth: number;
  lineHeight: number;
  blockGap: number;
}

/**
 * Wrapper around a three.js typeface font.
 * Handles glyph geometry caching (one geometry per character + style, shared by
 * every mesh using it) and pixel-accurate text layout using the font's own
 * advance widths — the same metrics TextGeometry uses internally.
 */
export default class Typography {
  private glyphs: Map<string, Glyph> = new Map();

  private constructor(public readonly font: Font) {}

  static load(url: string): Promise<Typography> {
    return new Promise((resolve, reject) => {
      new FontLoader().load(
        url,
        (font) => resolve(new Typography(font)),
        undefined,
        reject
      );
    });
  }

  /** Horizontal advance of a single character in pixels. */
  advance(char: string, size: number) {
    const glyph = this.font.data.glyphs[char] || this.font.data.glyphs["?"];
    return (glyph.ha / this.font.data.resolution) * size;
  }

  /** Width of a string in pixels, ignoring line breaks. */
  measure(text: string, size: number) {
    let width = 0;
    for (const char of text) width += this.advance(char, size);
    return width;
  }

  /**
   * Returns the (cached) geometry for a character, translated so that the mesh
   * origin sits in the middle of the glyph — letters have to rotate and tumble
   * around their own center, not around their baseline corner.
   */
  glyph(char: string, options: GlyphOptions): Glyph | null {
    if (char === " ") return null;

    const key = `${char}|${options.size}|${options.depth}|${options.bevel}`;
    const cached = this.glyphs.get(key);
    if (cached) return cached;

    // three's ExtrudeGeometry only builds the front/back caps while it walks the
    // bevel segments — with `bevelEnabled: false` the glyph comes out as a
    // hollow shell. A zero-sized bevel gives us flat letters that are closed.
    const flat = !options.bevel;

    const geometry = new TextGeometry(char, {
      font: this.font,
      size: options.size,
      depth: options.depth,
      curveSegments: options.curveSegments ?? (flat ? 3 : 6),
      bevelEnabled: true,
      bevelThickness: flat ? 0 : options.depth * 0.09,
      bevelSize: flat ? 0 : options.size * 0.018,
      bevelOffset: 0,
      bevelSegments: flat ? 1 : 3,
    });

    geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;

    const offset = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    geometry.translate(-offset.x, -offset.y, -offset.z);
    geometry.computeVertexNormals();

    const glyph: Glyph = { geometry, offset, size };
    this.glyphs.set(key, glyph);

    return glyph;
  }

  /**
   * Lays out one or more paragraphs into a centered block of a given max width.
   * Lines are word-wrapped and center-aligned, the whole block is centered
   * around (0, 0) so it can simply be dropped at the middle of the screen.
   */
  layout(paragraphs: Array<string>, options: LayoutOptions): Layout {
    const { size, maxWidth, lineHeight, blockGap } = options;
    const space = this.advance(" ", size);

    // 1. Word-wrap every paragraph into lines.
    const blocks: Array<Array<string>> = paragraphs.map((paragraph) => {
      const lines: Array<string> = [];
      let current = "";
      let currentWidth = 0;

      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const wordWidth = this.measure(word, size);
        const width = current ? currentWidth + space + wordWidth : wordWidth;

        if (current && width > maxWidth) {
          lines.push(current);
          current = word;
          currentWidth = wordWidth;
        } else {
          current = current ? `${current} ${word}` : word;
          currentWidth = width;
        }
      }

      if (current) lines.push(current);
      return lines;
    });

    // 2. Total height so we can center the block vertically.
    const lineCount = blocks.reduce((total, lines) => total + lines.length, 0);
    const height =
      lineCount * lineHeight + Math.max(0, blocks.length - 1) * blockGap;

    // 3. Place every character on its baseline.
    const chars: Array<PlacedChar> = [];
    let width = 0;
    let line = 0;
    let y = height / 2 - lineHeight * 0.72; // First baseline, from the top.

    blocks.forEach((lines, block) => {
      lines.forEach((text) => {
        const lineWidth = this.measure(text, size);
        width = Math.max(width, lineWidth);

        let x = -lineWidth / 2;

        for (const char of text) {
          if (char !== " ") chars.push({ char, x, y, block, line });
          x += this.advance(char, size);
        }

        y -= lineHeight;
        line++;
      });

      y -= blockGap;
    });

    return { chars, width, height, lines: lineCount };
  }

  dispose() {
    this.glyphs.forEach((glyph) => glyph.geometry.dispose());
    this.glyphs.clear();
  }
}
