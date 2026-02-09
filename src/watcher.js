import chokidar from "chokidar";
import path from "node:path";
import fs from "node:fs/promises";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

async function descriptionExists(imagePath) {
  const mdPath = imagePath.replace(/\.[^.]+$/, ".md");
  try {
    await fs.access(mdPath);
    return true;
  } catch {
    return false;
  }
}

export function watchDirectory(dir, onNewImage) {
  console.log(`Watching directory: ${path.resolve(dir)}`);

  const watcher = chokidar.watch(dir, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  watcher.on("add", async (filePath) => {
    if (!isImage(filePath)) return;

    const alreadyProcessed = await descriptionExists(filePath);
    if (alreadyProcessed) {
      console.log(`[skip] Already processed: ${filePath}`);
      return;
    }

    console.log(`[new] Image detected: ${filePath}`);
    onNewImage(filePath);
  });

  watcher.on("error", (error) => {
    console.error(`Watcher error: ${error.message}`);
  });

  return watcher;
}
