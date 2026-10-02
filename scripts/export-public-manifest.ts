import * as fs from "fs";
import * as path from "path";

// Regenerates deployments/public/<network>.json from the gitignored local manifest
// so the published addresses never drift from the actual deployment. Only public
// data (addresses, links, block numbers) is exported; secrets stay local.
const NETWORKS: Record<string, { chainId: number; explorer: string }> = {
  "base-sepolia": { chainId: 84532, explorer: "https://sepolia.basescan.org" },
  base: { chainId: 8453, explorer: "https://basescan.org" },
};

async function sourcifyMatch(chainId: number, address: string): Promise<string> {
  try {
    const response = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`);
    if (!response.ok) return "unknown";
    const body = await response.json();
    const match = body?.match ?? body?.verification?.match;
    if (match === "exact_match" || match === "match" || match === "match_creation") return "verified";
    return match ?? "unverified";
  } catch {
    return "unknown";
  }
}

// Etherscan V2 serves every EVM chain from one key, so a single entry covers every
// network above. Without a key the export still runs, just without explorer status.
async function etherscanVerified(chainId: number, address: string): Promise<string> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return "unknown";
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return "unknown";
    const body = (await response.json()) as { status?: string; result?: { ABI?: string }[] };
    if (body.status !== "1") return "unverified";
    const abi = body.result?.[0]?.ABI;
    if (!abi || abi === "Contract source code not verified") return "unverified";
    return "verified";
  } catch {
    return "unknown";
  }
}

async function main() {
  const network = process.argv[2] ?? process.env.NETWORK ?? "base-sepolia";
  const config = NETWORKS[network];
  if (!config) throw new Error(`unsupported network "${network}"`);

  const source = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(source)) throw new Error(`local deployment not found: ${source}`);
  const deployment = JSON.parse(fs.readFileSync(source, "utf8"));

  const contracts: Record<string, unknown> = {};
  const verification: Record<string, unknown> = {};
  for (const [name, address] of Object.entries(deployment.contracts ?? {}) as [string, string][]) {
    contracts[name] = address;
    verification[name] = {
      match: await sourcifyMatch(config.chainId, address),
      sourcify: `https://sourcify.dev/contract/${config.chainId}/${address}`,
      explorer: `${config.explorer}/address/${address}`,
      explorerSource: await etherscanVerified(config.chainId, address),
    };
    // Etherscan allows 5 calls per second, so pace the explorer lookups.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const demo = deployment.demoDomain;
  const publicManifest = {
    network,
    chainId: config.chainId,
    explorer: config.explorer,
    isL2: deployment.isL2 ?? true,
    owner: deployment.owner,
    deployer: deployment.deployer,
    treasury: deployment.treasury,
    deployedAt: deployment.timestamp,
    note: "Testnet deployment. Only public addresses are recorded here; secrets stay in gitignored env files.",
    contracts,
    verification,
    live: demo
      ? {
          registeredName: demo.name,
          exampleTx: `${config.explorer}/tx/${demo.tx}`,
        }
      : undefined,
  };

  const target = path.join(__dirname, "..", "deployments", "public", `${network}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(publicManifest, null, 2)}\n`);

  const verified = Object.values(verification).filter((entry) => (entry as { match: string }).match === "verified").length;
  const explorerVerified = Object.values(verification).filter((entry) => (entry as { explorerSource: string }).explorerSource === "verified").length;
  console.log(
    `exported ${Object.keys(contracts).length} contracts (sourcify=${verified} etherscan=${explorerVerified}) to ${target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});