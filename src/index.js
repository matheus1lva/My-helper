import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { watchDirectory } from "./watcher.js";
import { processImage, processAllImages } from "./generator.js";
import { ProcessingQueue } from "./queue.js";

const WATCH_DIR = process.env.WATCH_DIR || "./watched-images";
const isWatchMode = process.argv.includes("--watch");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const resolvedDir = path.resolve(WATCH_DIR);
  await ensureDir(resolvedDir);

  console.log("===========================================");
  console.log("  Marketplace Image Description Generator  ");
  console.log("===========================================");
  console.log(`Directory: ${resolvedDir}`);
  console.log(`Mode: ${isWatchMode ? "watch (continuous)" : "batch (one-time)"}`);
  console.log("");

  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set.");
    console.error("Create a .env file with: OPENAI_API_KEY=sk-your-key");
    process.exit(1);
  }

  // Batch mode: process all existing images and exit
  if (!isWatchMode) {
    console.log("Scanning for unprocessed images...\n");
    await processAllImages(resolvedDir);
    return;
  }

  // Watch mode: process existing + watch for new images
  const queue = new ProcessingQueue(processImage, 2);

  console.log("Watching for new images... (Ctrl+C to stop)\n");

  const watcher = watchDirectory(resolvedDir, (imagePath) => {
    queue.add(imagePath);
  });

  process.on("SIGINT", async () => {
    console.log("\nShutting down watcher...");
    await watcher.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
