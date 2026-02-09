import fs from "node:fs/promises";
import path from "node:path";
import { processImage } from "./generator.js";
import { replay } from "./replayer.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Parses a generated .md file and extracts the title and full description text.
 */
function parseMd(content) {
  const lines = content.split("\n");
  let title = "";
  let description = "";
  let tags = "";

  // Title: first H1
  const h1 = lines.find((l) => l.startsWith("# "));
  if (h1) title = h1.replace(/^#\s+/, "").trim();

  // Description: everything between ## Descricao and the next ##
  let inDescription = false;
  const descLines = [];
  for (const line of lines) {
    if (/^##\s+Descri[cç][aã]o/i.test(line)) {
      inDescription = true;
      continue;
    }
    if (inDescription && line.startsWith("## ")) {
      inDescription = false;
      continue;
    }
    if (inDescription) descLines.push(line);
  }
  description = descLines.join("\n").trim();

  // Tags: everything after ## Tags
  let inTags = false;
  const tagLines = [];
  for (const line of lines) {
    if (/^##\s+Tags/i.test(line)) {
      inTags = true;
      continue;
    }
    if (inTags && line.startsWith("## ")) break;
    if (inTags) tagLines.push(line);
  }
  tags = tagLines.join("\n").trim();

  return { title, description, tags, fullContent: content };
}

/**
 * For each product folder, generates descriptions (if missing) and
 * replays the recorded browser flow injecting title/description/tags.
 */
export async function automate(recordingFile, targetDir, options = {}) {
  const { headless = false, extraVars = {} } = options;

  console.log("===========================================");
  console.log("  Marketplace Auto-Publisher               ");
  console.log("===========================================");
  console.log(`Recording: ${recordingFile}`);
  console.log(`Directory: ${targetDir}`);
  console.log("");

  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set.");
    process.exit(1);
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());

  if (folders.length === 0) {
    console.log("No product folders found. Add subfolders with images.");
    return;
  }

  console.log(`Found ${folders.length} product folder(s)\n`);

  for (const folder of folders) {
    const folderPath = path.join(targetDir, folder.name);
    console.log(`--- Product: ${folder.name} ---`);

    // Find images in this folder
    const files = await fs.readdir(folderPath);
    const images = files.filter((f) =>
      IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())
    );

    if (images.length === 0) {
      console.log("  [skip] No images found\n");
      continue;
    }

    // Generate description for the first image if none exists
    const firstImage = path.join(folderPath, images[0]);
    const mdPath = firstImage.replace(/\.[^.]+$/, ".md");
    let mdContent;

    try {
      mdContent = await fs.readFile(mdPath, "utf-8");
      console.log(`  [ok] Description already exists`);
    } catch {
      console.log(`  [ai] Generating description for ${images[0]}...`);
      await processImage(firstImage);
      mdContent = await fs.readFile(mdPath, "utf-8");
    }

    const { title, description, tags } = parseMd(mdContent);

    console.log(`  Title: ${title.slice(0, 60)}...`);
    console.log(`  Replaying browser flow...`);

    // Build variables for replay
    const variables = {
      title,
      description,
      tags,
      folder: folder.name,
      imagePath: firstImage,
      ...extraVars,
    };

    await replay(recordingFile, variables, {
      headless,
      autoClose: true,
    });

    console.log(`  [done] ${folder.name}\n`);
  }

  console.log("All products processed.");
}
