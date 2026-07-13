/**
 * Copies the Stockfish WASM builds from node_modules into public/stockfish.
 * The engine must be served as plain static files — never bundled (ADR 003).
 * Runs automatically before dev/build.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "public", "stockfish");

const binDir = join(dirname(require.resolve("stockfish/package.json")), "bin");

const FILES = [
  "stockfish-18-lite.js",
  "stockfish-18-lite.wasm",
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

mkdirSync(target, { recursive: true });
let copied = 0;
for (const file of FILES) {
  const src = join(binDir, file);
  if (!existsSync(src)) {
    console.error(`copy-engine: missing ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(target, file));
  copied++;
}
console.log(`copy-engine: ${copied} engine files → public/stockfish`);
