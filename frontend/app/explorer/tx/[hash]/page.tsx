import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fetchTx, labelFor, short, formatEtherNative, formatArg, age } from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Transaction — BlockDNS L2",
  description: "Transaction detail on the BlockDNS L2 chain.",
};

export const dynamic = "force-dynamic";

export default async function TxDetailPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const tx = await fetchTx(hash);

  if (!tx) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <XCircle size={40} className="text-red-400" />
        <h1 className="text-xl font-bold">Transaction not found</h1>
        <p className="max-w-md text-sm text-zinc-400">
          {hash} does not exist on the current chain state. The in-memory node may
          have been restarted.
        </p>
        <Link href="/explorer" className="text-violet-400 hover:underline">
          ← Back to explorer
        </Link>
      </div>
    );
  }

  const argString = tx.decoded.args.length
    ? tx.decoded.args.map(formatArg).join(", ")
    : "";

  const rows: [string, ReactNode][] = [
    ["Transaction hash", <span key="h" className="font-mono break-all">{tx.hash}</span>],
    [
      "Status",
      tx.status === "Success" ? (
        <span key="s" className="inline-flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 size={16} /> Success
        </span>
      ) : (
        <span key="s" className="inline-flex items-center gap-1.5 text-red-400">
          <XCircle size={16} /> {tx.status}
        </span>
      ),
    ],
    ["Block", <Link key="b" className="font-mono text-cyan-300 hover:underline" href={`/explorer/block/${tx.blockNumber}`}>{tx.blockNumber?.toString()}</Link>],
    ["From", <span key="f" className="font-mono">{labelFor(tx.from)} <span className="text-zinc-500">({tx.from})</span></span>],
    ["To", <span key="t" className="font-mono">{tx.to ? `${labelFor(tx.to)} (${tx.to})` : "—"}</span>],
    ["Value", <span key="v" className="font-mono text-amber-300">{formatEtherNative(tx.value)} ETH</span>],
    ["Gas", <span key="g" className="font-mono">{tx.gas.toString()}</span>],
    ["Gas price", <span key="gp" className="font-mono">{formatEtherNative(tx.gasPrice)} gwei-equivalent</span>],
    [
      "Method",
      <span key="m" className="font-mono text-cyan-300">
        {tx.decoded.functionName || (tx.decoded.raw.length >= 10 ? `0x${tx.decoded.raw.slice(2, 10)}` : "0x")}
        {argString ? `(${argString})` : ""}
      </span>,
    ],
    ["Age", <span key="a">{age(tx.blockNumber ?? undefined)} — confirm before the chain restarts</span>],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/explorer" className="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Back to explorer
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Transaction</h1>
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
      <p className="text-xs text-zinc-500">
        Tips: hash ({short(tx.hash, 6, 4)}) — copy it and search to re-open this page.
      </p>
    </div>
  );
}