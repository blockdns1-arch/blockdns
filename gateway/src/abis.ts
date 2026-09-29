export const REGISTRY_ABI = [
  {
    type: "function",
    name: "resolveName",
    inputs: [{ name: "rawName", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nameOf",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ipfsCIDOf",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addressRecords",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

export const RESOLVER_ABI = [
  {
    type: "function",
    name: "resolveAll",
    inputs: [{ name: "name", type: "string" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "name", type: "string" },
      { name: "ipfsCID", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveIPFS",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "cid", type: "string" }],
    stateMutability: "view",
  },
] as const;