import fs from "node:fs/promises";
import path from "node:path";
import { analyzeImage } from "./vision.js";

function getOutputPath(imagePath) {
  return imagePath.replace(/\.[^.]+$/, ".md");
}

export async function processImage(imagePath) {
  const outputPath = getOutputPath(imagePath);
  const folderName = path.basename(path.dirname(imagePath));
  const fileName = path.basename(imagePath);

  console.log(`[processing] ${folderName}/${fileName} ...`);

  try {
    const description = await analyzeImage(imagePath);
    await fs.writeFile(outputPath, description, "utf-8");
    console.log(`[done] Description saved: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`[error] Failed to process ${fileName}: ${error.message}`);
    throw error;
  }
}

export async function processAllImages(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  let processed = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!imageExtensions.has(ext)) continue;

    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    const mdPath = fullPath.replace(/\.[^.]+$/, ".md");

    try {
      await fs.access(mdPath);
      skipped++;
      console.log(`[skip] Already has description: ${entry.name}`);
      continue;
    } catch {
      // md doesn't exist, process this image
    }

    await processImage(fullPath);
    processed++;
  }

  console.log(`\nBatch complete: ${processed} processed, ${skipped} skipped`);
}
