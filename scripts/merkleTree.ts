import { keccak256, solidityPacked, getAddress, concat } from "ethers";

export type AirdropEntry = {
  address: string;
  amount: bigint;
};

export type AirdropTree = {
  root: string;
  leaves: string[];
  proofs: Map<string, string[]>;
};

export function airdropLeaf(address: string, amount: bigint): string {
  return keccak256(solidityPacked(["address", "uint256"], [getAddress(address), amount]));
}

function hashPair(left: string, right: string): string {
  const order = left.toLowerCase() <= right.toLowerCase() ? [left, right] : [right, left];
  return keccak256(concat(order));
}

function computeLevels(sortedLeaves: string[]): string[][] {
  const levels: string[][] = [sortedLeaves.slice()];
  while (levels[levels.length - 1].length > 1) {
    const layer = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(hashPair(left, right));
    }
    levels.push(next);
  }
  return levels;
}

export function getMerkleProof(sortedLeaves: string[], index: number): string[] {
  const levels = computeLevels(sortedLeaves);
  const proof: string[] = [];
  let idx = index;
  for (let level = 0; level < levels.length - 1; level++) {
    const layer = levels[level];
    const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sibling < layer.length) proof.push(layer[sibling]);
    else if (sibling === layer.length) proof.push(layer[idx]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function buildAirdropTree(entries: AirdropEntry[]): AirdropTree {
  const leaves = entries
    .map((e) => airdropLeaf(e.address, e.amount))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const levels = computeLevels(leaves);
  const root = levels[levels.length - 1][0];

  const proofs = new Map<string, string[]>();
  for (const entry of entries) {
    const leaf = airdropLeaf(entry.address, entry.amount);
    const index = leaves.indexOf(leaf);
    proofs.set(getAddress(entry.address), getMerkleProof(leaves, index));
  }
  return { root, leaves, proofs };
}