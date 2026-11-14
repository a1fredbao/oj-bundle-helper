import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { transformCpp } from "../src/cpp";

const root = path.resolve(import.meta.dir, "..");
const dist = path.join(root, "dist");
const assets = path.join(root, "resources", "tree-sitter");
const queries = path.join(root, "resources", "queries");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [path.join(root, "src", "extension.ts")],
  outdir: dist,
  target: "node",
  format: "cjs",
  external: ["vscode"],
  sourcemap: "linked",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await Promise.all([
  copyFile(
    path.join(assets, "web-tree-sitter.wasm"),
    path.join(dist, "web-tree-sitter.wasm"),
  ),
  copyFile(
    path.join(assets, "tree-sitter-cpp.wasm"),
    path.join(dist, "tree-sitter-cpp.wasm"),
  ),
  cp(queries, path.join(dist, "queries"), { recursive: true }),
]);

const verification = await transformCpp(
  "int solve(int value) { int answer = value + 1; return answer; }",
  { resourceDirectory: dist },
);

if (
  verification.warnings.length > 0 ||
  verification.code !== "int solve(int b){int a=b+1;return a;}"
) {
  console.error("Built extension assets failed runtime verification.");
  console.error(verification);
  process.exit(1);
}
