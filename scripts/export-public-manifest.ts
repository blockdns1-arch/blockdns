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
    };
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
  console.log(`exported ${Object.keys(contracts).length} contracts (verified=${verified}) to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});