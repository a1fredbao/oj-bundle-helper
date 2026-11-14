import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "resources", "tree-sitter");

await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(
    path.join(root, "node_modules", "web-tree-sitter", "web-tree-sitter.wasm"),
    path.join(output, "web-tree-sitter.wasm"),
  ),
  copyFile(
    path.join(root, "node_modules", "tree-sitter-cpp", "tree-sitter-cpp.wasm"),
    path.join(output, "tree-sitter-cpp.wasm"),
  ),
]);
