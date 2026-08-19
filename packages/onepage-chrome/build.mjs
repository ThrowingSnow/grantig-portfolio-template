import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  jsx: "automatic",
  target: "es2020",
  external: ["react", "react-dom", "react/jsx-runtime"],
  logLevel: "info",
});

// The stylesheet ships flattened as well as in source form. styles/index.css is
// three @imports, which only a browser resolves — anything that consumes the
// file on its own (a bundler, a static copy) sees three dead references. This
// emits the single-file equivalent, with the Humane faces copied alongside it
// so the @font-face url()s still resolve next to the output.
await esbuild.build({
  entryPoints: ["styles/index.css"],
  outfile: "dist/styles.css",
  bundle: true,
  loader: { ".ttf": "file" },
  assetNames: "fonts/[name]",
  logLevel: "info",
});
