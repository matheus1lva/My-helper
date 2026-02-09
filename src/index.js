import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { watchDirectory } from "./watcher.js";
import { processImage, processAllImages } from "./generator.js";
import { ProcessingQueue } from "./queue.js";
import { record } from "./recorder.js";
import { replay } from "./replayer.js";
import { automate } from "./automate.js";

const WATCH_DIR = process.env.WATCH_DIR || "./watched-images";
const RECORDINGS_DIR = "./recordings";

const command = process.argv[2]; // --watch, record, replay, automate

function showHelp() {
  console.log(`
===========================================
  Marketplace Image Description Generator
===========================================

Usage:
  npm start                           Process all images (batch)
  npm run watch                       Watch for new images continuously

  npm run record [url]                Record browser clicks to a JSON file
  npm run replay <file> [--var k=v]   Replay a recorded session
  npm run automate <recording> <dir>  Auto-publish: generate descriptions + replay for each product

Options for replay/automate:
  --var title="..."                   Inject variable into replay
  --var description="..."             Inject variable into replay
  --headless                          Run browser in headless mode

Examples:
  npm run record https://olx.com.br
  npm run replay recordings/olx-flow.json --var title="iPhone 12"
  npm run automate recordings/olx-flow.json watched-images/
`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function parseVars(args) {
  const vars = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--var" && args[i + 1]) {
      const [key, ...rest] = args[i + 1].split("=");
      vars[key] = rest.join("=");
      i++;
    }
  }
  return vars;
}

async function main() {
  // --- Record mode ---
  if (command === "record") {
    await ensureDir(RECORDINGS_DIR);
    const startUrl = process.argv[3] || "about:blank";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outputFile = path.join(RECORDINGS_DIR, `recording-${timestamp}.json`);
    await record(outputFile, startUrl);
    return;
  }

  // --- Replay mode ---
  if (command === "replay") {
    const file = process.argv[3];
    if (!file) {
      console.error("Usage: npm run replay <recording-file> [--var key=value ...]");
      process.exit(1);
    }
    const variables = parseVars(process.argv.slice(4));
    const headless = process.argv.includes("--headless");
    await replay(file, variables, { headless });
    return;
  }

  // --- Automate mode: descriptions + replay for each product folder ---
  if (command === "automate") {
    const recordingFile = process.argv[3];
    const targetDir = process.argv[4] || WATCH_DIR;
    if (!recordingFile) {
      console.error("Usage: npm run automate <recording-file> [directory]");
      process.exit(1);
    }
    const headless = process.argv.includes("--headless");
    const extraVars = parseVars(process.argv.slice(5));
    await automate(recordingFile, path.resolve(targetDir), { headless, extraVars });
    return;
  }

  // --- Help ---
  if (command === "--help" || command === "-h" || command === "help") {
    showHelp();
    return;
  }

  // --- Standard image processing modes ---
  const resolvedDir = path.resolve(WATCH_DIR);
  await ensureDir(resolvedDir);

  console.log("===========================================");
  console.log("  Marketplace Image Description Generator  ");
  console.log("===========================================");
  console.log(`Directory: ${resolvedDir}`);
  console.log("");

  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set.");
    console.error("Create a .env file with: OPENAI_API_KEY=sk-your-key");
    process.exit(1);
  }

  const isWatchMode = command === "--watch";

  if (!isWatchMode) {
    console.log("Mode: batch (one-time)");
    console.log("Scanning for unprocessed images...\n");
    await processAllImages(resolvedDir);
    return;
  }

  // Watch mode
  console.log("Mode: watch (continuous)");
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
