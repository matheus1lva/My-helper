import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Replays a previously recorded session.
 * Supports variable injection so you can replace placeholder values
 * (e.g. {{title}}, {{description}}) with real data at replay time.
 */
export async function replay(recordingFile, variables = {}, options = {}) {
  const { headless = false, slowMo = 300 } = options;

  const raw = await fs.readFile(path.resolve(recordingFile), "utf-8");
  const recording = JSON.parse(raw);
  const actions = recording.actions;

  console.log(`\n--- Playwright Replayer ---`);
  console.log(`Recording: ${recordingFile} (${actions.length} actions)`);
  console.log(`Variables: ${Object.keys(variables).join(", ") || "(none)"}`);
  console.log("");

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const label = `[${i + 1}/${actions.length}]`;

    try {
      switch (action.type) {
        case "navigate": {
          console.log(`${label} navigate -> ${action.url}`);
          await page.goto(action.url, { waitUntil: "domcontentloaded" });
          break;
        }

        case "click": {
          console.log(`${label} click "${action.selector}"`);
          await page.locator(action.selector).first().click({ timeout: 10000 });
          break;
        }

        case "dblclick": {
          console.log(`${label} dblclick "${action.selector}"`);
          await page.locator(action.selector).first().dblclick({ timeout: 10000 });
          break;
        }

        case "type": {
          const value = interpolate(action.value, variables);
          console.log(`${label} type "${action.selector}" -> "${value.slice(0, 50)}..."`);
          const locator = page.locator(action.selector).first();
          await locator.click({ timeout: 10000 });
          await locator.fill(value);
          break;
        }

        case "select": {
          const value = interpolate(action.value, variables);
          console.log(`${label} select "${action.selector}" -> "${value}"`);
          await page.locator(action.selector).first().selectOption(value, { timeout: 10000 });
          break;
        }

        case "check": {
          console.log(`${label} check "${action.selector}" (${action.checked})`);
          const loc = page.locator(action.selector).first();
          if (action.checked) {
            await loc.check({ timeout: 10000 });
          } else {
            await loc.uncheck({ timeout: 10000 });
          }
          break;
        }

        case "scroll": {
          console.log(`${label} scroll (${action.scrollX}, ${action.scrollY})`);
          await page.evaluate(
            ([x, y]) => window.scrollTo(x, y),
            [action.scrollX, action.scrollY]
          );
          break;
        }

        default:
          console.log(`${label} [skip] unknown action: ${action.type}`);
      }
    } catch (err) {
      console.error(`${label} [error] ${action.type} "${action.selector}": ${err.message}`);
    }

    // Small pause between actions for stability
    await page.waitForTimeout(200);
  }

  console.log("\nReplay complete.");

  if (!options.autoClose) {
    console.log("Browser left open. Close it manually when done.");
    await new Promise((resolve) => browser.on("disconnected", resolve));
  } else {
    await browser.close();
  }
}

/**
 * Replace {{variable}} placeholders in a string with values from the map.
 */
function interpolate(text, variables) {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}
