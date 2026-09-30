import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const req = createRequire(import.meta.url);
const pkg = req.resolve("hardhat/package.json");
const pj = req(pkg);
const bin = typeof pj.bin === "string" ? pj.bin : pj.bin.hardhat;
const cli = path.join(path.dirname(pkg), bin);

if (!fs.existsSync(cli)) {
  console.error("NO CLI AT", cli);
  process.exit(2);
}

process.argv = ["node", "cli", ...process.argv.slice(2)];

const mod = await import(pathToFileURL(cli).href);
const run = typeof mod.main === "function" ? mod.main : mod.default?.main;
if (typeof run !== "function") {
  console.error("main not found in hardhat cli");
  process.exit(3);
}
await run();