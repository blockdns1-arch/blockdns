import { encodeAbiParameters, type Hex } from "viem";
import type { ResolvedView } from "./resolver";

export type CcipReadResponse = {
  data: Hex;
};

export function buildCcipResponse(resolved: ResolvedView): CcipReadResponse {
  const data = encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "string" },
      { type: "string" },
    ] as const,
    [
      resolved.cid,
      resolved.addresses["ETH"] || "",
      resolved.addresses["BTC"] || "",
      resolved.addresses["SOL"] || "",
    ]
  );
  return { data };
}

export function buildCcipLookupNotFound(name: string): { error: string } {
  return { error: `domain "${name}" is not resolved on BlockDNS` };
}

export function ccipAbiSignatures(): string {
  return (
    "resolve(string name) returns (string ipfsCID, string eth, string btc, string sol)"
  );
}