import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { resolveOwner } from "./treasury";

const L2_CHAIN_ID = Number(process.env.L2_CHAIN_ID ?? "8461");

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const { chainId } = await provider.getNetwork();
  const isL2 = Number(chainId) === L2_CHAIN_ID;
  const cap = ethers.parseEther(process.env.BDNS_CAP ?? "1000000000");
  const owner = resolveOwner(network.name, deployer.address);

  console.log(`network=${network.name} chainId=${chainId} deployer=${deployer.address} owner=${owner}`);

  const bdns = await ethers.deployContract("BDNS", [cap, owner]);
  await bdns.waitForDeployment();
  const bdnsAddress = await bdns.getAddress();
  console.log(`BDNS deployed at ${bdnsAddress} (admin=${owner})`);

  const genesisMint = process.env.BDNS_GENESIS_MINT;
  if (genesisMint && genesisMint !== "0") {
    const amount = ethers.parseEther(genesisMint);
    const minted = await bdns.mint(owner, amount);
    await minted.wait();
    console.log(`minted ${genesisMint} BDNS to ${owner}`);
  }

  const messengerName = isL2 ? "L2CrossDomainMessenger" : "L1CrossDomainMessenger";
  const messenger = await ethers.deployContract(messengerName);
  await messenger.waitForDeployment();
  const messengerAddress = await messenger.getAddress();
  console.log(`${messengerName} deployed at ${messengerAddress}`);

  const remote = process.env.REMOTE_MESSENGER ?? ethers.ZeroAddress;
  const initTx = await messenger.initialize(owner, remote);
  await initTx.wait();
  console.log(`${messengerName} initialized (admin=${owner}, remote=${remote})`);

  const relayer = process.env.RELAYER_ADDRESS;
  if (relayer && relayer !== ethers.ZeroAddress) {
    const role = await messenger.RELAYER_ROLE();
    const roleTx = await messenger.grantRole(role, relayer);
    await roleTx.wait();
    console.log(`RELAYER_ROLE granted to ${relayer}`);
  }

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    isL2,
    owner,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      BDNS: bdnsAddress,
      [messengerName]: messengerAddress,
    },
    init: {
      remoteMessenger: remote,
      relayer: relayer ?? null,
    },
  };
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});