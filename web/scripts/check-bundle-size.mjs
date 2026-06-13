import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve("dist/assets");
const maxBytes = 325 * 1024;

const assetNames = await readdir(assetsDir);
const jsAssets = assetNames.filter((name) => name.endsWith(".js"));

if (jsAssets.length === 0) {
  throw new Error(`No JavaScript assets found in ${assetsDir}`);
}

const assetSizes = await Promise.all(
  jsAssets.map(async (name) => {
    const filePath = path.join(assetsDir, name);
    const fileStats = await stat(filePath);
    return { name, bytes: fileStats.size };
  }),
);

const largestAsset = assetSizes.reduce((largest, current) =>
  current.bytes > largest.bytes ? current : largest,
);

if (largestAsset.bytes > maxBytes) {
  const actualKb = (largestAsset.bytes / 1024).toFixed(2);
  const limitKb = (maxBytes / 1024).toFixed(2);
  throw new Error(
    `Bundle size check failed: ${largestAsset.name} is ${actualKb} kB, above the ${limitKb} kB limit.`,
  );
}

const actualKb = (largestAsset.bytes / 1024).toFixed(2);
const limitKb = (maxBytes / 1024).toFixed(2);
console.log(
  `Bundle size check passed: largest asset ${largestAsset.name} is ${actualKb} kB within the ${limitKb} kB limit.`,
);
