#!/usr/bin/env node
/**
 * Generate frontend/public/docs/BlockDNS_Whitepaper.pdf from WHITEPAPER.md.
 *
 * Renders the markdown through a dark, on-brand HTML template and prints it
 * with headless Chromium (Puppeteer). Pure Node — no TS build step required.
 *
 * Usage:
 *   node scripts/generate-whitepaper-pdf.js
 *   OUTPUT=./whitepaper.pdf node scripts/generate-whitepaper-pdf.js
 */

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const MD_PATH = process.env.WHITEPAPER_PATH || path.join(ROOT, "WHITEPAPER.md");
const OUT_PATH = process.env.OUTPUT || path.join(ROOT, "frontend", "public", "docs", "BlockDNS_Whitepaper.pdf");

const ACCENT = "#8b5cf6";
const ACCENT2 = "#22d3ee";
const BG = "#0b1020";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildHtml(markdown) {
  const body = marked.parse(markdown, {
    gfm: true,
    async: false,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body {
    font-family: 'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: ${BG}; color: #c9d2e3; line-height: 1.65;
    margin: 0; padding: 0;
  }
  .cover {
    text-align:center; padding: 3.5em 1em 2.5em; margin: 0 0 0.5em; break-after: page;
    background: radial-gradient(ellipse at top, rgba(139,92,246,0.4), transparent 55%);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .cover h1 { font-size: 2.4rem; margin: 0 0 0.2em; color: #fff; letter-spacing: 0.02em; }
  .cover .tag { color: ${ACCENT2}; margin-bottom: 1.2em; font-size: 0.95rem; }
  .badges span {
    display:inline-block; margin: 0.25em 0.3em; padding: 0.35em 0.9em; border-radius: 2em;
    background: rgba(139,92,246,0.14); color: ${ACCENT2}; font-size: 0.75rem;
    border: 1px solid rgba(139,92,246,0.4);
  }
  h1 { font-size: 1.7rem; color: #fff; border-bottom: 1px solid rgba(139,92,246,0.4); padding-bottom: 0.25em; margin-top: 1.6em; }
  h2 { font-size: 1.35rem; color: #fff; margin-top: 1.4em; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 0.2em; }
  h3, h4 { font-size: 1.05rem; color: #e6ebf7; margin-top: 1.1em; }
  h1, h2, h3, h4, table, blockquote { break-after: avoid; }
  p { margin: 0.55em 0; }
  a { color: ${ACCENT2}; text-decoration: none; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9rem; }
  table th, table td { border: 1px solid rgba(255,255,255,0.14); padding: 0.5em 0.7em; text-align: left; }
  table thead tr { background: rgba(139,92,246,0.16); color: #fff; }
  code {
    background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 0.3em;
    color: ${ACCENT2}; font-size: 0.88em;
  }
  blockquote {
    margin: 1em 0; padding: 0.8em 1.1em; border-left: 3px solid ${ACCENT};
    background: rgba(139,92,246,0.09); border-radius: 0.4em; color: #a9b3d1;
  }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 2em 0; }
  li { margin: 0.28em 0; }
  ul, ol { padding-left: 1.4em; }
  .toc { margin: 1.4em 0; padding: 1em 1.4em; background: rgba(255,255,255,0.04); border-radius: 0.6em; }
  .toc ul { list-style: none; padding-left: 0; margin: 0.6em 0 0; columns: 2; color: #a9b3d1; }
  .diagram {
    margin: 1.2em 0; padding: 1em; border-radius: 0.8em;
    border: 1px solid rgba(34,211,238,0.35); background: #0a0f14;
  }
  .diagram .cap { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: #22d3ee; margin-bottom: 0.6em; }
  .flow-box {
    display: flex; align-items: center; gap: 0.55em; font-family: 'Consolas', monospace; font-size: 0.78rem;
    color: #a5f3fc; flex-wrap: wrap;
  }
  .flow-node {
    border: 1px solid rgba(34,211,238,0.6); border-radius: 0.5em; padding: 0.4em 0.7em;
    background: rgba(34,211,238,0.08);
  }
  .flow-arrow { color: #22d3ee; }
</style>
</head>
<body>
  <div class="cover">
    <h1>BlockDNS Whitepaper</h1>
    <div class="tag">Lifetime on-chain naming · .bdns domains · IPFS · multi-wallet identity</div>
    <div class="badges">
      <span>ERC-721 registry</span><span>ERC-20 BDNS</span><span>2.5% market fee → 5-way split</span>
      <span>Decaying 500M burn vault</span><span>60/15/10/5/5/5 allocation</span>
    </div>
    <div class="diagram" style="text-align:left;">
      <div class="cap">Diagram 1 — Layer 2 Flow</div>
      <div class="flow-box">
        <span class="flow-node">Client DNS lookup</span><span class="flow-arrow">→</span>
        <span class="flow-node">L2 Registry / Resolver</span><span class="flow-arrow">→</span>
        <span class="flow-node">BDNS token &amp; burn</span><span class="flow-arrow">→</span>
        <span class="flow-node">L2 → L1 bridge</span>
      </div>
    </div>
    <div class="diagram" style="text-align:left;">
      <div class="cap">Diagram 2 — Global network map</div>
      <div class="flow-box">
        <span class="flow-node">EU node</span><span class="flow-arrow">◆</span>
        <span class="flow-node">L2 core</span><span class="flow-arrow">◆</span>
        <span class="flow-node">APAC node</span><span class="flow-arrow">◆</span>
        <span class="flow-node">AF node</span><span class="flow-arrow">◆</span>
        <span class="flow-node">L1 settlement</span>
      </div>
    </div>
  </div>
  <main>${body}</main>
  <footer style="margin-top:2.5em;padding-top:1em;border-top:1px solid rgba(255,255,255,0.12);font-size:0.78rem;color:#7a86a4;text-align:center;">
    BlockDNS — generated directly from WHITEPAPER.md
  </footer>
</body>
</html>`;
}

function resolveChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  const cacheDir =
    process.env.PUPPETEER_CACHE_DIR || path.join(process.env.LOCALAPPDATA || "", "puppeteer", "cache");
  if (fs.existsSync(cacheDir)) {
    try {
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = walk(p);
            if (found) return found;
          } else if (entry.name.toLowerCase() === "chrome.exe") {
            return p;
          }
        }
        return null;
      };
      const found = walk(cacheDir);
      if (found) return found;
    } catch {}
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

async function main() {
  const chrome = resolveChrome();
  if (!chrome) {
    console.error("Chrome executable not found. Install it or set PUPPETEER_EXECUTABLE_PATH.");
    process.exit(1);
  }

  const md = fs.readFileSync(MD_PATH, "utf8");
  const html = buildHtml(md);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chrome,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: OUT_PATH,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:8px;color:#7a86a4;">BlockDNS Whitepaper · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      headerTemplate: "<span></span>",
    });
    console.log(`PDF written to ${path.relative(ROOT, OUT_PATH)}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});