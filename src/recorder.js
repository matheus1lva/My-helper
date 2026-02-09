import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Opens a browser and injects a script that records every user click,
 * typing, navigation, and scroll into a structured action list.
 * When the user closes the browser, the recording is saved as JSON.
 */
export async function record(outputFile, startUrl = "about:blank") {
  const resolvedOutput = path.resolve(outputFile);
  const actions = [];

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // --- Expose a bridge so the injected script can push actions to Node ---
  await context.exposeFunction("__recorderPush", (action) => {
    const parsed = JSON.parse(action);
    parsed.timestamp = Date.now();
    actions.push(parsed);
    const label = formatAction(parsed);
    console.log(`  [rec] ${label}`);
  });

  // --- Inject the recorder overlay + listeners into every frame ---
  await context.addInitScript({ content: recorderScript() });

  // Track navigations
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      actions.push({
        type: "navigate",
        url: frame.url(),
        timestamp: Date.now(),
      });
      console.log(`  [rec] navigate -> ${frame.url()}`);
    }
  });

  console.log("\n--- Playwright Recorder ---");
  console.log(`Recording to: ${resolvedOutput}`);
  console.log("Interact with the browser. Close it when done.\n");

  await page.goto(startUrl);

  // Wait until the user closes the browser window
  await new Promise((resolve) => browser.on("disconnected", resolve));

  // Save
  const recording = {
    version: 1,
    createdAt: new Date().toISOString(),
    actions,
  };

  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, JSON.stringify(recording, null, 2), "utf-8");

  console.log(`\nRecording saved: ${resolvedOutput} (${actions.length} actions)`);
  return recording;
}

function formatAction(a) {
  switch (a.type) {
    case "click":
      return `click "${a.selector}" (${a.x},${a.y})`;
    case "dblclick":
      return `dblclick "${a.selector}"`;
    case "type":
      return `type "${a.selector}" -> "${a.value?.slice(0, 40)}"`;
    case "select":
      return `select "${a.selector}" -> "${a.value}"`;
    case "check":
      return `check "${a.selector}" (${a.checked})`;
    case "scroll":
      return `scroll (${a.scrollX}, ${a.scrollY})`;
    case "navigate":
      return `navigate -> ${a.url}`;
    default:
      return JSON.stringify(a);
  }
}

/**
 * Returns the JS code injected into the browser page.
 * It captures clicks, input changes, selects, and checkboxes,
 * generating robust CSS selectors for each target element.
 */
function recorderScript() {
  return `
    (function() {
      if (window.__recorderActive) return;
      window.__recorderActive = true;

      // ---- Selector generation ----
      function getSelector(el) {
        if (el.id) return '#' + CSS.escape(el.id);
        if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
        if (el.getAttribute('name')) return el.tagName.toLowerCase() + '[name="' + el.getAttribute('name') + '"]';
        if (el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label') + '"]';
        if (el.getAttribute('placeholder')) return '[placeholder="' + el.getAttribute('placeholder') + '"]';
        if (el.getAttribute('href') && el.tagName === 'A') {
          const href = el.getAttribute('href');
          if (href.length < 100) return 'a[href="' + href + '"]';
        }
        // Class-based fallback
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\\s+/).filter(c => c && !c.match(/^(active|hover|focus|selected|open)/)).slice(0, 3);
          if (classes.length > 0) {
            const sel = el.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
            if (document.querySelectorAll(sel).length === 1) return sel;
          }
        }
        // nth-child fallback
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(el) + 1;
          return getSelector(parent) + ' > ' + el.tagName.toLowerCase() + ':nth-child(' + index + ')';
        }
        return el.tagName.toLowerCase();
      }

      // ---- Badge overlay ----
      const badge = document.createElement('div');
      badge.textContent = 'REC';
      badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:999999;background:#e53e3e;color:#fff;padding:4px 12px;border-radius:12px;font:bold 13px system-ui;pointer-events:none;opacity:0.85;';
      document.documentElement.appendChild(badge);

      // ---- Event listeners ----
      document.addEventListener('click', (e) => {
        window.__recorderPush(JSON.stringify({
          type: 'click',
          selector: getSelector(e.target),
          tag: e.target.tagName,
          text: (e.target.innerText || '').slice(0, 80),
          x: e.clientX,
          y: e.clientY,
        }));
      }, true);

      document.addEventListener('dblclick', (e) => {
        window.__recorderPush(JSON.stringify({
          type: 'dblclick',
          selector: getSelector(e.target),
        }));
      }, true);

      document.addEventListener('input', (e) => {
        const el = e.target;
        if (el.tagName === 'SELECT') {
          window.__recorderPush(JSON.stringify({
            type: 'select',
            selector: getSelector(el),
            value: el.value,
          }));
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          window.__recorderPush(JSON.stringify({
            type: 'check',
            selector: getSelector(el),
            checked: el.checked,
          }));
        } else {
          // debounce typing
          clearTimeout(el.__recTimeout);
          el.__recTimeout = setTimeout(() => {
            window.__recorderPush(JSON.stringify({
              type: 'type',
              selector: getSelector(el),
              value: el.value,
            }));
          }, 500);
        }
      }, true);

      // Scroll (debounced)
      let scrollTimer;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          window.__recorderPush(JSON.stringify({
            type: 'scroll',
            scrollX: window.scrollX,
            scrollY: window.scrollY,
          }));
        }, 400);
      }, true);
    })();
  `;
}
