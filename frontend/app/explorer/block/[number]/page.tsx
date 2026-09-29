import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { client, short, labelFor, formatEtherNative, age, decodeCall, formatArg } from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Block — BlockDNS L2",
  description: "Block detail on the BlockDNS L2 chain.",
};

export const dynamic = "force-dynamic";

export default async function BlockDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const blockNumber = BigInt(number || "0");
  try {
    const block: any = await client.getBlock({
      blockNumber,
      includeTransactions: true,
    });

    const rows: [string, ReactNode][] = [
      ["Block height", <span key="n" className="font-mono">{blockNumber.toString()}</span>],
      ["Age", <span key="a">{age(block.timestamp)}</span>],
      ["Timestamp", <span key="t" className="font-mono">{new Date(Number(block.timestamp) * 1000).toISOString()}</span>],
      ["Transactions", <span key="tn">{block.transactions.length}</span>],
      ["Gas used", <span key="gu" className="font-mono">{block.gasUsed.toString()}</span>],
      ["Gas limit", <span key="gl" className="font-mono">{block.gasLimit.toString()}</span>],
    ];

    return (
      <div className="flex flex-col gap-6">
        <Link href="/explorer" className="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> Back to explorer
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Block #{blockNumber.toString()}</h1>
        <div className="eth-card overflow-hidden p-0">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} className="border-b border-white/5 last:border-0">
                  <td className="w-44 px-5 py-3 align-top bg-white/[0.015] text-zinc-500">{k}</td>
                  <td className="px-5 py-3 text-zinc-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="eth-card overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold">Transactions in this block</div>
          <div className="divide-y divide-white/5">
            {(block.transactions as any[]).map((tx: any) => {
              const d = decodeCall(tx.input || "0x");
              const method = d.functionName || (tx.input && tx.input.length >= 10 ? `0x${tx.input.slice(2, 10)}` : "0x");
              const args = d.args.length ? `(${d.args.map(formatArg).join(", ")})` : "";
              return (
                <div key={tx.hash} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-3 text-sm sm:grid-cols-[auto_1fr_auto]">
                  <span className="font-mono text-cyan-300">
                    <Link href={`/explorer/tx/${tx.hash}`} className="hover:underline">{short(tx.hash)}</Link>
                  </span>
                  <span className="text-zinc-400">
                    {labelFor(tx.from)} → {labelFor(tx.to || "")}{" "}
                    <span className="font-mono text-cyan-300">{method}</span>
                    <span className="text-zinc-500">{args}</span>
                  </span>
                  {tx.value > 0n && (
                    <span className="font-mono text-xs text-amber-300">{formatEtherNative(tx.value)} ETH</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } catch {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-xl font-bold">Block not found</h1>
        <p className="text-sm text-zinc-400">Block #{number} does not exist on the current chain.</p>
        <Link href="/explorer" className="text-violet-400 hover:underline">← Back to explorer</Link>
      </div>
    );
  }
}