/**
 * The route the config page saves its copy through.
 *
 * On its own in a module with no imports because both sides need it: the plugin
 * in `copy-writer.ts` runs in node and reaches for `node:fs`, and the panel runs
 * in the browser. Importing the plugin from the panel would drag the filesystem
 * into the client bundle for the sake of one string.
 */
export const COPY_ROUTE = "/__copy";
