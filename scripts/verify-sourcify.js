// Verifies every deployed contract on Sourcify v2 using the exact build-info
// Hardhat produced, so no Etherscan API key is required.
//
// Sourcify matches compiled runtime bytecode against on-chain code, therefore
// constructor arguments are not part of the submission.
//
// Usage: npm run verify:sourcify [-- --network base-sepolia]

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const SOURCIFY = process.env.SOURCIFY_URL || "https://sourcify.dev/server";
const DEFAULT_CHAIN_ID = 84532;

// Manifest key -> Solidity contract name. Vault wrappers share one contract.
const CONTRACT_NAME_OVERRIDES = {
  TeamVestingVault: "BDNSVestingVault",
  MarketingVestingVault: "BDNSVestingVault",
  EcosystemVestingVault: "BDNSVestingVault",
  LiquidityVestingVault: "BDNSVestingVault",
};

function parseNetwork() {
  const index = process.argv.indexOf("--network");
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : "base-sepolia";
}

const CHAIN_IDS = { "base-sepolia": DEFAULT_CHAIN_ID, base: 8453 };
const RPC_URLS = {
  "base-sepolia": process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
};

function loadBuildInfos() {
  const dir = path.join(ROOT, "artifacts", "build-info");
  if (!fs.existsSync(dir)) throw new Error("artifacts/build-info missing: run `npx hardhat compile` first");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const buildInfo = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      buildInfo.id = buildInfo.id ?? file;
      return buildInfo;
    });
}

// Hardhat keeps a build-info per compile, so the same contract can appear in
// several of them. Only the one that matches the source on disk AND the
// bytecode actually deployed produces a verification, so candidates are scored.
function findContract(buildInfos, name, onChainLength) {
  const candidates = [];
  for (const buildInfo of buildInfos) {
    for (const [sourcePath, contracts] of Object.entries(buildInfo.output?.contracts ?? {})) {
      if (!contracts[name]) continue;

      const deployed = contracts[name].evm.deployedBytecode.object;
      const lengthMatches = onChainLength > 0 && deployed.length / 2 === onChainLength;
      const diskSource = readIfPresent(path.join(ROOT, sourcePath));
      const buildSource = buildInfo.input.sources[sourcePath]?.content;
      const sourceMatches = diskSource !== null && buildSource === diskSource;

      let compilerVersion = buildInfo.solcVersion;
      const metadata = contracts[name].metadata;
      if (metadata) {
        try {
          // The full "x.y.z+commit.hash" version is required by the Sourcify API;
          // build-info only stores the short solcVersion.
          compilerVersion = JSON.parse(metadata).compiler?.version ?? compilerVersion;
        } catch {
          // fall back to the short version
        }
      }

      candidates.push({
        buildInfo,
        identifier: `${sourcePath}:${name}`,
        compilerVersion,
        score: (lengthMatches ? 2 : 0) + (sourceMatches ? 2 : 0),
        label: `${buildInfo.id} length=${lengthMatches} source=${sourceMatches}`,
      });
    }
  }
  if (candidates.length === 0) throw new Error(`no build-info found for contract "${name}"`);
  candidates.sort((a, b) => b.score - a.score || b.buildInfo.id.localeCompare(a.buildInfo.id));
  return { chosen: candidates[0], rejected: candidates.slice(1) };
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

async function onChainCodeLength(network, address) {
  const url = process.env.RPC_URL || RPC_URLS[network];
  if (!url) return 0;
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const code = await provider.getCode(address);
    return (code.length - 2) / 2;
  } catch {
    return 0;
  }
}

function stdJsonInput(buildInfo) {
  const { language, sources, settings } = buildInfo.input;
  const missing = Object.entries(sources).filter(([, source]) => typeof source.content !== "string");
  if (missing.length > 0) {
    throw new Error(`build-info ${buildInfo.id} lacks inline source content for: ${missing.map(([key]) => key).join(", ")}`);
  }
  return { language, sources, settings };
}

async function submit(chainId, address, payload) {
  const response = await fetch(`${SOURCIFY}/v2/verify/${chainId}/${address}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409 && body.customCode === "already_verified") {
    return { verificationId: null, alreadyVerified: true, message: body.message };
  }
  if (!response.ok) {
    throw new Error(`submit failed (${response.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

// Read-only check of what Sourcify currently stores for an address.
async function storedStatus(chainId, address) {
  const response = await fetch(`${SOURCIFY}/v2/contract/${chainId}/${address}`);
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  const match = body?.match ?? body?.verification?.match;
  if (match === "exact_match" || match === "match") return "verified";
  if (match === "match_creation") return "verified";
  if (match) return `partial:${match}`;
  return null;
}

async function poll(verificationId, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(`${SOURCIFY}/v2/verify/${verificationId}`);
    const body = await response.json().catch(() => ({}));
    if (!body.isJobCompleted && !body.error) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      continue;
    }
    return body;
  }
  return { isJobCompleted: false, error: { message: "timed out waiting for Sourcify job" } };
}

function classify(body) {
  const runtimeMatch = body.contract?.runtimeMatch;
  if (runtimeMatch === "match" || runtimeMatch === "exact_match") {
    return { status: "verified" };
  }
  if (body.error) {
    const message = body.error.message ?? JSON.stringify(body.error);
    if (/already verified/i.test(message)) return { status: "already_verified" };
    return { status: "failed", message };
  }
  return { status: "failed", message: `no match (runtimeMatch=${body.contract?.runtimeMatch})` };
}

async function main() {
  const network = parseNetwork();
  const chainId = CHAIN_IDS[network] ?? DEFAULT_CHAIN_ID;
  const manifestPath = path.join(ROOT, "deployments", `${network}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error(`deployment manifest not found: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let contracts = Object.entries(manifest.contracts ?? {});
  if (contracts.length === 0) throw new Error(`no contracts recorded in ${manifestPath}`);

  const onlyIndex = process.argv.indexOf("--only");
  if (onlyIndex !== -1 && process.argv[onlyIndex + 1]) {
    const only = process.argv[onlyIndex + 1].toLowerCase();
    contracts = contracts.filter(([key]) => key.toLowerCase() === only);
    if (contracts.length === 0) throw new Error(`no contract named "${process.argv[onlyIndex + 1]}" in ${manifestPath}`);
  }

  const buildInfos = loadBuildInfos();
  console.log(`sourcify=${SOURCIFY} chain=${chainId} network=${network} contracts=${contracts.length}`);

  const results = [];
  for (const [key, address] of contracts) {
    const name = CONTRACT_NAME_OVERRIDES[key] ?? key;
    let payload;
    try {
      const onChainLength = await onChainCodeLength(network, address);
      const { chosen, rejected } = findContract(buildInfos, name, onChainLength);
      payload = {
        stdJsonInput: stdJsonInput(chosen.buildInfo),
        compilerVersion: chosen.compilerVersion,
        contractIdentifier: chosen.identifier,
      };
      console.log(`${key} ${address} build-info=${chosen.label}`);
      if (rejected.length > 0 && chosen.score < 4) {
        console.log(`  warning: no candidate matched both source and bytecode (tried ${rejected.length + 1})`);
      }
    } catch (error) {
      results.push({ key, address, status: `no-build-info: ${error.message}` });
      continue;
    }

    try {
      const submitted = await submit(chainId, address, payload);
      if (submitted.alreadyVerified) {
        const status = (await storedStatus(chainId, address)) ?? "verified";
        results.push({ key, address, status });
        console.log(`${address} ${key} -> ${status} (already verified)`);
        continue;
      }
      const verificationId = submitted.verificationId ?? submitted.id;
      if (!verificationId) {
        results.push({ key, address, status: `no-verification-id: ${JSON.stringify(submitted).slice(0, 200)}` });
        continue;
      }
      const { status, message } = classify(await poll(verificationId));
      results.push({ key, address, status, message });
      console.log(`${address} ${key} -> ${status}${message ? ` (${message})` : ""}`);
    } catch (error) {
      results.push({ key, address, status: `error: ${error.message}` });
      console.log(`${address} ${key} -> ${error.message}`);
    }
  }

  const ok = results.filter((result) => result.status === "verified" || result.status === "already_verified");
  console.log(`\nverified=${ok.length}/${results.length}`);
  for (const result of results) {
    if (result.status !== "verified" && result.status !== "already_verified") {
      console.log(`FAILED ${result.key} ${result.address} ${result.status} ${result.message ?? ""}`);
    }
  }
  console.log("\nsourcify links:");
  for (const result of results) console.log(`  ${result.key} https://sourcify.dev/contract/${chainId}/${result.address}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});