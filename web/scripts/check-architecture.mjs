import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const allowedRootEntries = new Set([
  "app",
  "core",
  "main.tsx",
  "modules",
  "vite-env.d.ts",
]);
const disallowedBarrels = [];
const unexpectedRootEntries = [];
const sizeViolations = [];
const maxSourceLines = 300;

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
    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const contents = await readFile(fullPath, "utf8");
      const lineCount = contents.split("\n").length;
      if (lineCount > maxSourceLines) {
        sizeViolations.push(
          `${relativePath}: ${lineCount} > ${maxSourceLines}`,
        );
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

if (sizeViolations.length > 0) {
  console.error("File budgets exceeded:");
  for (const entry of sizeViolations.sort()) console.error(`- ${entry}`);
  process.exit(1);
}
