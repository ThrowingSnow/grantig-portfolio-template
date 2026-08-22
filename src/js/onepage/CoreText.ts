import Typography from "./Typography";
import { contentWidth } from "./settings";

interface Props {
  typography: Typography;
  text: string;
}

export interface CoreTarget {
  char: string;
  /** Baseline-left position of the glyph, relative to the middle of the screen. */
  x: number;
  y: number;
}

/** Smallest glyph size the block is ever laid out at, in pixels. */
const FLOOR_SIZE = 18;

/** Rows the copy is sized to fill. Word wrap decides the exact count. */
const LINES = 3;

/**
 * The block the swarm reassembles into once the sphere has left.
 *
 * This owns no meshes: the letters that compose it are the ones that were
 * already orbiting, handed over by `LetterField`, which animates them into the
 * places computed here. All this class does is work out where those places are.
 *
 * Nothing has to be passed left and right of the sphere any more — by the time
 * a letter arrives, the mass is gone — so the copy gets the full content width
 * and is sized to fill a few rows rather than squeezed onto a single one. A
 * hundred-odd characters on one line would come out unreadably small.
 */
export default class CoreText {
  private typography: Typography;
  private text: string;

  /** Glyph size the block is laid out at, in pixels. */
  size = 0;
  targets: Array<CoreTarget> = [];

  constructor({ typography, text }: Props) {
    this.typography = typography;
    this.text = text;

    this.build();
  }

  private get metrics() {
    const maxWidth = contentWidth();
    const cap = Math.min(64, Math.max(26, window.innerWidth * 0.036));
    const natural = this.typography.measure(this.text, cap);

    // Shrink until the string is long enough to fill `LINES` rows — and never
    // grow past the cap, so short copy stays a headline instead of ballooning.
    const fitted = (cap * maxWidth * LINES) / Math.max(1, natural);

    return { maxWidth, size: Math.max(FLOOR_SIZE, Math.min(cap, fitted)) };
  }

  private build() {
    const { size, maxWidth } = this.metrics;

    const layout = this.typography.layout([this.text], {
      size,
      maxWidth,
      lineHeight: size * 1.5,
      blockGap: 0,
    });

    this.size = size;
    this.targets = layout.chars.map((char) => ({
      char: char.char,
      x: char.x,
      y: char.y,
    }));
  }

  onResize() {
    this.build();
  }
}
