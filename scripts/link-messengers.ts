import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function loadDeployment(name: string): {
  contracts: Record<string, string>;
  isL2?: boolean;
} {
  const file = path.join(__dirname, "..", "deployments", `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing deployment file: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function messengerOf(deployment: {
  contracts: Record<string, string>;
}): string {
  const address =
    deployment.contracts.L1CrossDomainMessenger ??
    deployment.contracts.L2CrossDomainMessenger;
  if (!address) {
    throw new Error("no messenger found in deployment");
  }
  return address;
}

async function main() {
  const peerName = process.env.PEER_NETWORK;
  if (!peerName) {
    throw new Error("PEER_NETWORK env variable is required");
  }
  const current = loadDeployment(network.name);
  const peer = loadDeployment(peerName);

  const messengerName = current.contracts.L1CrossDomainMessenger
    ? "L1CrossDomainMessenger"
    : "L2CrossDomainMessenger";
  const messenger = await ethers.getContractAt(
    messengerName,
    messengerOf(current)
  );
  const peerAddress = messengerOf(peer);

  const tx = await messenger.setRemoteMessenger(peerAddress);
  await tx.wait();
  console.log(
    `${network.name}: ${messengerName} remote set to ${peerAddress}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});