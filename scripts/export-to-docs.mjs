import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");
const docsDir = join(root, "docs");

if (!existsSync(outDir)) {
  console.error("[export-to-docs] Missing out/ directory. Run `pnpm build` with GITHUB_PAGES=true first.");
  process.exit(1);
}

rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });
cpSync(outDir, docsDir, { recursive: true });
writeFileSync(join(docsDir, ".nojekyll"), "");

console.log("[export-to-docs] Copied static export to docs/");
