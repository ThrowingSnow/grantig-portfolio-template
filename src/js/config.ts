import { COPY_ROUTE } from "../dev/copy-route";
import { TUNE_COLORS, TUNE_GROUPS, type Knob } from "./onepage/tune-schema";
import {
  COPY_KEY,
  COPY_TOLERANCE,
  TUNING_KEY,
  toSource,
  type Copy,
  type SceneHandle,
  type Tuning,
} from "./onepage/tuning";

/**
 * The tuning page behind `/config.html`.
 *
 * It runs the real one-pager in a same-origin iframe and writes straight into
 * the scene's live settings object, so a slider is visible on the next frame.
 * Nothing here ships to visitors: the scene only exposes its handle while it is
 * embedded, and only reads the stored values in that case.
 */

const frame = document.querySelector<HTMLIFrameElement>("[data-frame]")!;
const groups = document.querySelector<HTMLElement>("[data-groups]")!;
const jump = document.querySelector<HTMLElement>("[data-jump]")!;
const toast = document.querySelector<HTMLElement>("[data-toast]")!;

/** Everything currently being tried out, in the flat shape `apply()` takes. */
const tuning: Tuning = { tune: {}, colors: {} };

let handle: SceneHandle | null = null;

/**
 * Copy being typed but not applied yet. Kept out of `localStorage` on purpose:
 * applying is what reloads the frame, and a half-typed paragraph should not
 * survive as if it had been.
 */
let draft: Copy | null = null;

/* Storage
--------------------------------------------------------- */

function load() {
  try {
    const stored = window.localStorage.getItem(TUNING_KEY);
    if (!stored) return;

    const parsed = JSON.parse(stored) as Partial<Tuning>;
    Object.assign(tuning.tune, parsed.tune ?? {});
    Object.assign(tuning.colors, parsed.colors ?? {});
  } catch {
    // Nothing worth recovering — the panel simply starts from the defaults.
  }
}

let saveTimer = 0;

function save() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    window.localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
  }, 200);
}

/* The frame
--------------------------------------------------------- */

/**
 * The scene installs its handle only after the font has loaded, which is well
 * after the frame's `load` event — so this polls instead of listening.
 */
function connect(): Promise<SceneHandle | null> {
  return new Promise((resolve) => {
    const deadline = performance.now() + 15000;

    const poll = () => {
      const found = frame.contentWindow?.__onepage;
      if (found) return resolve(found);
      if (performance.now() > deadline) return resolve(null);
      window.requestAnimationFrame(poll);
    };

    poll();
  });
}

async function attach() {
  handle = await connect();

  if (!handle) {
    note("Scene did not report in — reload the frame.");
    return;
  }

  // The scene has already restored the stored values itself; this only fills in
  // the readouts for anything the panel does not have an entry for yet.
  const current = handle.snapshot();
  for (const [path, value] of Object.entries(current.tune)) {
    if (!(path in tuning.tune)) tuning.tune[path] = value;
  }
  for (const [key, value] of Object.entries(current.colors)) {
    if (!(key in tuning.colors)) tuning.colors[key] = value;
  }

  render();
}

/** Colours are baked into materials when the scene is built, so this rebuilds. */
function reloadFrame() {
  save();
  window.localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
  frame.contentWindow?.location.reload();
  attach();
}

/* Panel
--------------------------------------------------------- */

/** A step of 0.05 wants two decimals, a step of 5 wants none. */
const format = (knob: Knob, value: number) => {
  const digits = (String(knob.step).split(".")[1] ?? "").length;
  return `${value.toFixed(digits)}${knob.unit ?? ""}`;
};

function buildKnob(knob: Knob) {
  const row = document.createElement("label");
  row.className = "knob";

  const label = document.createElement("span");
  label.className = "knob__label";
  label.textContent = knob.label;

  const readout = document.createElement("span");
  readout.className = "knob__value";

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(knob.min);
  input.max = String(knob.max);
  input.step = String(knob.step);

  const value = tuning.tune[knob.path] ?? handle?.defaults.tune[knob.path] ?? 0;
  input.value = String(value);
  readout.textContent = format(knob, value);

  const dirty = () => {
    const base = handle?.defaults.tune[knob.path];
    row.classList.toggle("knob--dirty", base !== undefined && base !== Number(input.value));
  };

  dirty();

  input.addEventListener("input", () => {
    const next = Number(input.value);

    tuning.tune[knob.path] = next;
    readout.textContent = format(knob, next);
    dirty();

    handle?.apply({ tune: { [knob.path]: next } });
    if (knob.structural) refresh();

    save();
  });

  row.append(label, readout, input);
  return row;
}

/** Relayouts are not free, so a dragged structural slider only rebuilds once. */
let refreshTimer = 0;

function refresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => handle?.refresh(), 120);
}

function buildColors() {
  const box = document.createElement("div");
  box.className = "swatches";

  for (const swatch of TUNE_COLORS) {
    const row = document.createElement("label");
    row.className = "swatch";

    const input = document.createElement("input");
    input.type = "color";
    input.value = tuning.colors[swatch.key] ?? "#000000";

    // On `change`, not `input`: every step of a drag would reload the frame.
    input.addEventListener("change", () => {
      tuning.colors[swatch.key] = input.value;
      reloadFrame();
    });

    const name = document.createElement("span");
    name.textContent = swatch.label;

    row.append(input, name);
    box.append(row);
  }

  return box;
}

function render() {
  groups.replaceChildren();

  for (const group of TUNE_GROUPS) {
    const box = document.createElement("details");
    box.className = "group";
    box.open = true;

    const title = document.createElement("summary");
    title.className = "group__title";
    title.textContent = group.title;
    box.append(title);

    if (group.note) {
      const note = document.createElement("p");
      note.className = "group__note";
      note.textContent = group.note;
      box.append(note);
    }

    for (const knob of group.knobs) box.append(buildKnob(knob));
    groups.append(box);
  }

  const copy = document.createElement("details");
  copy.className = "group";
  copy.open = false;

  const copyTitle = document.createElement("summary");
  copyTitle.className = "group__title";
  copyTitle.textContent = "The copy";
  copy.append(copyTitle);

  const copyNote = document.createElement("p");
  copyNote.className = "group__note";
  copyNote.textContent =
    "Every character is a mesh, and a falling one is a physics body too — so each block may run 20% either side of the length the scene is tuned for. Applying rebuilds the frame.";
  copy.append(copyNote, buildCopy());

  groups.append(copy);

  const colors = document.createElement("details");
  colors.className = "group";
  colors.open = true;

  const title = document.createElement("summary");
  title.className = "group__title";
  title.textContent = "Colours";
  colors.append(title);

  const note = document.createElement("p");
  note.className = "group__note";
  note.textContent = "Baked into the materials, so changing one reloads the frame.";
  colors.append(note, buildColors());

  groups.append(colors);
}

/* Copy
--------------------------------------------------------- */

const PARAGRAPH_SPLIT = /\n\s*\n/;

/** Characters as the budget counts them: whitespace collapsed, ends trimmed. */
const measure = (text: string) => text.replace(/\s+/g, " ").trim().length;

const budget = (shipped: number) => ({
  min: Math.round(shipped * (1 - COPY_TOLERANCE)),
  max: Math.round(shipped * (1 + COPY_TOLERANCE)),
});

const letters = (text: string) =>
  text.replace(/\s+/g, "").toUpperCase().split("");

/**
 * How many glyphs the new line would need that the paragraphs cannot supply.
 *
 * Those get conjured out of the sphere rather than recycled, which still works
 * — but the more of them there are, the less the line reads as the same matter
 * rearranged, and that is the whole point of the move.
 */
function conjured(paragraphs: string, core: string) {
  const stock = new Map<string, number>();
  for (const char of letters(paragraphs)) {
    stock.set(char, (stock.get(char) ?? 0) + 1);
  }

  let short = 0;
  for (const char of letters(core)) {
    const left = stock.get(char) ?? 0;
    if (left > 0) stock.set(char, left - 1);
    else short++;
  }

  return short;
}

function currentDraft(): Copy {
  if (draft) return draft;

  const live = handle?.copy();
  const next: Copy = {
    banner: live?.banner ?? "",
    paragraphs: live?.paragraphs ?? [],
    core: live?.core ?? "",
    drift: live?.drift ?? [],
  };

  draft = next;
  return next;
}

function buildCopy() {
  const box = document.createElement("div");
  box.className = "copy";

  const shipped = handle?.shippedCopy;
  const value = currentDraft();

  const fields: Array<{
    key: keyof Copy;
    label: string;
    rows: number;
    shipped: number;
    get: () => string;
    set: (text: string) => void;
  }> = [
    {
      key: "banner",
      label: "Banner",
      rows: 2,
      shipped: measure(shipped?.banner ?? ""),
      get: () => value.banner,
      set: (text) => (value.banner = text),
    },
    {
      key: "paragraphs",
      label: "Paragraphs — blank line between them",
      rows: 7,
      shipped: measure((shipped?.paragraphs ?? []).join(" ")),
      get: () => value.paragraphs.join("\n\n"),
      set: (text) => {
        value.paragraphs = text.split(PARAGRAPH_SPLIT).map((p) => p.trim()).filter(Boolean);
      },
    },
    {
      key: "core",
      label: "The line the sphere leaves behind",
      rows: 4,
      shipped: measure(shipped?.core ?? ""),
      get: () => value.core,
      set: (text) => (value.core = text),
    },
    {
      key: "drift",
      label: "Level two — one word per line",
      rows: 8,
      shipped: measure((shipped?.drift ?? []).join(" ")),
      get: () => value.drift.join("\n"),
      set: (text) => {
        value.drift = text.split("\n").map((word) => word.trim()).filter(Boolean);
      },
    },
  ];

  const apply = document.createElement("button");
  const counts: Array<() => boolean> = [];

  const sync = () => {
    const inRange = counts.map((check) => check()).every(Boolean);
    apply.disabled = !inRange;
    alphabet.textContent = alphabetNote();
  };

  const alphabet = document.createElement("p");
  alphabet.className = "group__note copy__alphabet";

  const alphabetNote = () => {
    const short = conjured(value.paragraphs.join(" "), value.core);
    if (!short) return "Every letter of the line comes out of the paragraphs.";
    return `${short} ${short === 1 ? "glyph has" : "glyphs have"} to be conjured — the paragraphs cannot spell the line on their own.`;
  };

  for (const field of fields) {
    const row = document.createElement("label");
    row.className = "copy__field";

    const label = document.createElement("span");
    label.className = "copy__label";
    label.textContent = field.label;

    const count = document.createElement("span");
    count.className = "copy__count";

    const input = document.createElement("textarea");
    input.rows = field.rows;
    input.spellcheck = false;
    input.value = field.get();

    const { min, max } = budget(field.shipped);

    const check = () => {
      const length = measure(input.value);
      const ok = length >= min && length <= max;

      count.textContent = `${length} / ${min}–${max}`;
      row.classList.toggle("copy__field--over", !ok);

      return ok;
    };

    counts.push(check);
    check();

    input.addEventListener("input", () => {
      field.set(input.value);
      sync();
    });

    row.append(label, count, input);
    box.append(row);
  }

  box.append(alphabet);

  const actions = document.createElement("div");
  actions.className = "copy__actions";

  apply.type = "button";
  apply.textContent = "Apply copy";
  apply.addEventListener("click", () => {
    window.localStorage.setItem(COPY_KEY, JSON.stringify(value));
    reloadFrame();
    note("Copy applied — the frame is rebuilding");
  });

  const store = document.createElement("button");
  store.type = "button";
  store.textContent = "Save to index.html";
  store.addEventListener("click", async () => {
    store.disabled = true;
    note("Saving…");

    try {
      const response = await fetch(COPY_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });

      const result = (await response.json()) as { error?: string; file?: string };
      if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);

      // The stored copy would shadow what was just written, and the panel
      // measures its budget against the file — so both start over from it.
      window.localStorage.removeItem(COPY_KEY);
      draft = null;
      reloadFrame();

      note(`Saved to ${result.file ?? "index.html"}`);
    } catch (error) {
      note(`Could not save — ${(error as Error).message}`);
    } finally {
      store.disabled = false;
    }
  });

  const markup = document.createElement("button");
  markup.type = "button";
  markup.textContent = "Copy as HTML";
  markup.addEventListener("click", async () => {
    const html = toMarkup(value);

    try {
      await navigator.clipboard.writeText(html);
      note("Markup copied — paste into index.html");
    } catch {
      console.log(html);
      note("Clipboard refused — the markup is in the console");
    }
  });

  actions.append(apply, store, markup);
  box.append(actions);

  sync();
  return box;
}

/** The copy in the shape `index.html` holds it, ready to be pasted back. */
function toMarkup(copy: Copy) {
  const paragraphs = copy.paragraphs
    .map((text) => `  <p data-webgl="paragraph">${text}</p>`)
    .join("\n");

  const drift = copy.drift
    .map((word) => `  <p data-webgl="drift">${word}</p>`)
    .join("\n");

  return [
    `<h1 class="visually-hidden" data-webgl="banner">${copy.banner}</h1>`,
    "",
    paragraphs,
    "",
    `<p data-webgl="core">${copy.core}</p>`,
    "",
    drift,
  ].join("\n");
}

/* Jump targets
--------------------------------------------------------- */

const PHASES: Array<[string, number]> = [
  ["hero", 0],
  ["hold", 0.6],
  ["gravity", 0.8],
  ["split", 0.9],
  ["orbit", 0.95],
  ["sweep", 0.5],
  ["flip", 0.6],
  ["drift", 0.3],
];

for (const [panel, offset] of PHASES) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = panel;
  button.addEventListener("click", () => handle?.goTo(panel, offset));
  jump.append(button);
}

/* Actions
--------------------------------------------------------- */

let toastTimer = 0;

function note(message: string) {
  toast.textContent = message;
  toast.dataset.visible = "true";

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.dataset.visible = "false"), 2400);
}

document.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
  const source = toSource(handle?.snapshot() ?? tuning);

  try {
    await navigator.clipboard.writeText(source);
    note("Settings copied — paste into settings.ts");
  } catch {
    // Clipboard access can be refused; the console is always available.
    console.log(source);
    note("Clipboard refused — the settings are in the console");
  }
});

document.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
  window.localStorage.removeItem(TUNING_KEY);
  window.localStorage.removeItem(COPY_KEY);
  tuning.tune = {};
  tuning.colors = {};
  draft = null;
  frame.contentWindow?.location.reload();
  attach();
  note("Back to the values and the copy in the source");
});

document.querySelector('[data-action="collapse"]')?.addEventListener("click", () => {
  const trigger = frame.contentDocument?.querySelector<HTMLButtonElement>(
    '[data-action="collapse"]'
  );

  if (!trigger || trigger.disabled) {
    note("The sphere only takes a click once the swarm is orbiting it.");
    return;
  }

  trigger.click();
});

load();
attach();
