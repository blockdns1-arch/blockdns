export const TREASURY_ADDRESS = "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe";

const LOCAL_NETWORKS = new Set(["hardhat"]);

export function resolveOwner(networkName: string, deployer: string): string {
  if (LOCAL_NETWORKS.has(networkName)) return deployer;
  return process.env.TREASURY_ADDRESS ?? TREASURY_ADDRESS;
}

export function resolveTreasury(networkName: string, deployer: string): string {
  return resolveOwner(networkName, deployer);
}