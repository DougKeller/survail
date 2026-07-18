import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const allowedRootEntries = new Set([
  "app",
  "core",
  "designsystem",
  "main.tsx",
  "modules",
  "vite-env.d.ts",
]);
const disallowedBarrels = [];
const misplacedStylesheets = [];
const unexpectedRootEntries = [];

// Existing re-export barrels, grandfathered until their exports are inlined.
// Do not add to this list — import from the defining module instead.
const allowedBarrels = new Set([
  "app/deckPrimitives.tsx",
  "modules/cards/ui/cardPresentation.tsx",
]);

function isReexportOnly(contents) {
  const stripped = contents
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const hasReexport =
    /export\s+(?:\*|\{[\s\S]*?\}|type\s+\{[\s\S]*?\})\s+from/.test(stripped);
  const hasDefinitions =
    /\b(?:function|class|const|let|var|enum)\b/.test(stripped) ||
    /\binterface\s/.test(stripped) ||
    /\btype\s+\w+\s*=/.test(stripped);
  return hasReexport && !hasDefinitions;
}

// File-size budgets are enforced by ESLint's max-lines rule (single source of
// truth, including its per-file overrides); this script checks structure only.
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath);
    if (directory === root && !allowedRootEntries.has(entry.name)) {
      unexpectedRootEntries.push(relativePath);
    }
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (entry.name === "index.ts" || entry.name === "index.tsx") {
      disallowedBarrels.push(relativePath);
    }
    // App code composes design-system components; stylesheets live only in
    // src/designsystem (beside their component, or the base/tokens layers).
    if (
      entry.name.endsWith(".css") &&
      !relativePath.startsWith(`designsystem${path.sep}`)
    ) {
      misplacedStylesheets.push(relativePath);
    }
    if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !allowedBarrels.has(relativePath) &&
      entry.name !== "vite-env.d.ts"
    ) {
      const contents = await readFile(fullPath, "utf8");
      if (isReexportOnly(contents)) {
        disallowedBarrels.push(`${relativePath} (re-export-only barrel)`);
      }
    }
  }
}

const sourceStats = await stat(root);
if (!sourceStats.isDirectory()) {
  throw new Error("src directory was not found");
}

await walk(root);

if (unexpectedRootEntries.length > 0) {
  console.error("Unexpected src root entries:");
  for (const entry of unexpectedRootEntries.sort()) console.error(`- ${entry}`);
  process.exit(1);
}

if (disallowedBarrels.length > 0) {
  console.error("Barrel files are not allowed:");
  for (const entry of disallowedBarrels.sort()) console.error(`- ${entry}`);
  process.exit(1);
}

if (misplacedStylesheets.length > 0) {
  console.error("Stylesheets are only allowed under src/designsystem:");
  for (const entry of misplacedStylesheets.sort()) console.error(`- ${entry}`);
  process.exit(1);
}
