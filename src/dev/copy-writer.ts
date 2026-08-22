import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Plugin } from "vite";

import { COPY_ROUTE } from "./copy-route";

/**
 * Writes the copy from `/config.html` back into `index.html`.
 *
 * The config page can edit the text live, but a browser cannot save it — so
 * every change had to be pasted by hand. This closes that loop: the panel POSTs
 * the copy here and the dev server edits the file on disk.
 *
 * Dev only, and deliberately so. It is registered with `apply: "serve"`, so it
 * is not part of a build and never reaches a deployed site; the route exists
 * exactly as long as someone is running `npm run dev` on their own machine.
 *
 * Nothing here parses HTML. It finds the elements by their `data-webgl` marker,
 * keeps each opening tag exactly as it was written, and swaps out the text
 * between the tags — so the classes, the comments and the rest of the file come
 * through a save untouched.
 */

/** The only file this is allowed to touch — no path ever comes from the client. */
const TARGET = "index.html";

/** How wide the file is formatted, for wrapping a saved line like a written one. */
const WIDTH = 80;

interface Copy {
  banner: string;
  paragraphs: Array<string>;
  core: string;
  drift: Array<string>;
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Matches one element carrying `data-webgl="<marker>"`, capturing its
 * indentation and its opening tag so both survive the rewrite.
 */
const pattern = (tag: string, marker: string) =>
  new RegExp(
    `^([ \\t]*)(<${tag}\\b[^>]*\\bdata-webgl="${marker}"[^>]*>)[\\s\\S]*?</${tag}>[ \\t]*\\r?\\n`,
    "gm"
  );

/** Greedy wrap: as many words as fit in the width, one line at a time. */
function wrap(text: string, width: number) {
  const lines: Array<string> = [];
  let line = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }

  if (line) lines.push(line);
  return lines;
}

/**
 * One element, written the way the file writes them: on a single line if it
 * fits, otherwise with the text indented one step between the tags.
 */
function render(open: string, tag: string, text: string, indent: string) {
  const close = `</${tag}>`;
  const body = escape(text);
  const inline = `${indent}${open}${body}${close}`;

  if (inline.length <= WIDTH) return inline;

  // Once it does not fit, the text goes on its own lines, indented one step —
  // so every line has the same room, the opening tag no longer shares one.
  const lines = wrap(body, WIDTH - indent.length - 2);
  return [
    `${indent}${open}`,
    ...lines.map((line) => `${indent}  ${line}`),
    `${indent}${close}`,
  ].join("\n");
}

/** Every place the marker occurs, outermost first, with what it needs to rebuild. */
function find(html: string, tag: string, marker: string) {
  return Array.from(html.matchAll(pattern(tag, marker))).map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    indent: match[1],
    open: match[2],
  }));
}

/**
 * Replaces a run of elements with one per entry, in the place the run held.
 *
 * The old ones are cut out back to front and the new block goes in where the
 * first one started, rather than editing them in place: the run has to be able
 * to shrink and grow, and a rewrite that walked forward would find the elements
 * it had just written and treat them as leftovers.
 */
function replace(html: string, tag: string, marker: string, texts: Array<string>) {
  const found = find(html, tag, marker);
  if (found.length === 0) throw new Error(`no <${tag} data-webgl="${marker}"> in ${TARGET}`);

  const { indent, open, start } = found[0];
  const block = texts.map((text) => render(open, tag, text, indent)).join("\n");

  let out = html;
  for (const spot of [...found].reverse()) {
    out = out.slice(0, spot.start) + out.slice(spot.end);
  }

  return out.slice(0, start) + (block ? `${block}\n` : "") + out.slice(start);
}

const clean = (texts: Array<string>) =>
  texts.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);

const isCopy = (value: unknown): value is Copy => {
  const copy = value as Copy;
  return (
    !!copy &&
    typeof copy.banner === "string" &&
    typeof copy.core === "string" &&
    Array.isArray(copy.paragraphs) &&
    Array.isArray(copy.drift) &&
    copy.paragraphs.every((text) => typeof text === "string") &&
    copy.drift.every((word) => typeof word === "string")
  );
};

/** Rewrites the four blocks and leaves the rest of the file — comments too — alone. */
export function writeCopy(html: string, copy: Copy) {
  let out = replace(html, "h1", "banner", clean([copy.banner]));
  out = replace(out, "p", "paragraph", clean(copy.paragraphs));
  out = replace(out, "p", "core", clean([copy.core]));
  out = replace(out, "p", "drift", clean(copy.drift));

  return out;
}

export default function copyWriter(): Plugin {
  return {
    name: "onepage-copy-writer",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use(COPY_ROUTE, (request, response, next) => {
        if (request.method !== "POST") return next();

        const reply = (status: number, body: object) => {
          response.statusCode = status;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(body));
        };

        const chunks: Array<Buffer> = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));

        request.on("end", async () => {
          const path = resolve(server.config.root, TARGET);

          try {
            const copy: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!isCopy(copy)) return reply(400, { error: "not a copy payload" });

            const html = await readFile(path, "utf8");
            const next = writeCopy(html, copy);

            if (next !== html) await writeFile(path, next, "utf8");
            reply(200, { written: next !== html, file: TARGET });
          } catch (error) {
            reply(500, { error: (error as Error).message });
          }
        });
      });
    },
  };
}
