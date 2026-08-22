import { resolve } from "node:path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

import copyWriter from "./src/dev/copy-writer";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // The one-pager, plus the original codrops text demo.
        main: resolve(__dirname, "index.html"),
        original: resolve(__dirname, "original.html"),
        // The tuning page — runs the one-pager in a frame, ships no scene of
        // its own. See README, "Tuning".
        config: resolve(__dirname, "config.html"),
      },
    },
  },
  plugins: [
    glsl({
      include: [
        "**/*.glsl",
        "**/*.wgsl",
        "**/*.vert",
        "**/*.frag",
        "**/*.vs",
        "**/*.fs",
      ],
      exclude: undefined,
      // Glob pattern, or array of glob patterns to ignore
      warnDuplicatedImports: true,
      // Warn if the same chunk was imported multiple times
      defaultExtension: "glsl",
      // Shader suffix when no extension is specified
      watch: true,
      // Recompile shader on change
      root: "/",
    }),
    // Lets the config page save its copy into index.html. Dev only.
    copyWriter(),
  ],
  // config options
});
