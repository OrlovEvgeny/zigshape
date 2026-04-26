// Bundle the extension to a single CommonJS file VS Code can load.
// The CommonJS target is required because vscode's extension host only
// loads `main` via require().

import { build, context } from "esbuild";

const isWatch = process.argv.includes("--watch");

const cfg = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.cjs",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
};

if (isWatch) {
  const ctx = await context(cfg);
  await ctx.watch();
} else {
  await build(cfg);
}
