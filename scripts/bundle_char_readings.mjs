import { readdir, readFile, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const SRC = "public/data/char_readings";
const OUT_DIR = "public/data/char_bundles";
const BUNDLE_SIZE = 256; // characters per bundle

const files = (await readdir(SRC)).filter(f => f.endsWith(".json"));

// Group by code range
const groups = {};
for (const f of files) {
  const code = f.replace(".json", "");
  const cp = parseInt(code, 16);
  const bundleIndex = Math.floor(cp / BUNDLE_SIZE);
  if (!groups[bundleIndex]) groups[bundleIndex] = {};
  const raw = await readFile(join(SRC, f), "utf-8");
  groups[bundleIndex][code] = JSON.parse(raw);
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const baseHex = 0x4E00; // CJK Unified Ideographs start
const bundleKeys = Object.keys(groups).sort((a, b) => +a - +b);
for (const k of bundleKeys) {
  const start = +k * BUNDLE_SIZE;
  const end = start + BUNDLE_SIZE - 1;
  const startHex = start.toString(16).toUpperCase().padStart(5, "0");
  const outFile = join(OUT_DIR, `${startHex}.json`);
  await writeFile(outFile, JSON.stringify(groups[k]));
}

console.log(`Bundled ${files.length} chars into ${bundleKeys.length} bundles`);
