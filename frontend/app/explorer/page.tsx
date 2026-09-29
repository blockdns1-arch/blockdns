import Link from "next/link";
import { Boxes, Database, Zap } from "lucide-react";
import type { Metadata } from "next";
import ExplorerSearch from "@/components/ExplorerSearch";
import {
  fetchLatestBlocks,
  fetchRecentTxs,
  short,
  labelFor,
  formatEtherNative,
  age,
  type ExplorerBlock,
  type ExplorerTx,
} from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Explorer — BlockDNS L2",
  description: "Blocks and transactions on the BlockDNS L2 chain.",
};

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
  const ok = status === "Success";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {status}
    </span>
  );
}

function MethodBadge({ call, input }: { call: { functionName: string; raw: string }; input?: string }) {
  const name =
    call.functionName ||
    (input && input.length >= 10 && input !== "0x" ? `0x${input.slice(2, 10)}` : "0x");
  return (
    <span className="mono inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#b6bdff]">
      {name}
    </span>
  );
}

export default async function ExplorerPage() {
  let blocks: ExplorerBlock[] = [];
  let txs: ExplorerTx[] = [];
  let error: string | null = null;
  try {
    const latest = (await fetchLatestBlocks(1))[0]?.number ?? 0n;
    [blocks, txs] = await Promise.all([fetchLatestBlocks(12), fetchRecentTxs(latest, 15)]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center justify-between gap-5 pt-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            BlockDNS L2 · Mainnet
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Explorer</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live view of the local chain (endpoint{" "}
            <span className="mono text-xs">{process.env.NEXT_PUBLIC_L2_RPC_URL || "http://127.0.0.1:9545"}</span>)
          </p>
        </div>
        <ExplorerSearch />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Unable to reach the chain: {error}
        </div>
      )}

      {!error && (
        <>
          <section className="eth-card overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <Database size={15} className="text-[#b6bdff]" />
              <h2 className="text-sm font-semibold">Latest blocks</h2>
              <span className="ml-auto hidden font-mono text-xs text-zinc-600 sm:block">
                {blocks.length ? `#${blocks[blocks.length - 1]?.number} → #${blocks[0]?.number}` : "—"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="eth-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Age</th>
                    <th>Txn</th>
                    <th className="text-right">Gas used</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => {
                    const pct = b.gasLimit > 0n ? Number((b.gasUsed * 100n) / b.gasLimit) : 0;
                    return (
                      <tr key={b.number.toString()}>
                        <td>
                          <Link href={`/explorer/block/${b.number}`} className="mono text-[#9ea4ff] hover:underline">
                            #{b.number.toString()}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-400">{age(b.timestamp)}</td>
                        <td className="mono text-zinc-300">{b.transactions.length}</td>
                        <td className="text-right">
                          <div className="ml-auto flex h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#5964ff] to-[#22d3ee]"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {blocks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                        No blocks yet — mint, list, or trade to create transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="eth-card overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <Zap size={15} className="text-[#b6bdff]" />
              <h2 className="text-sm font-semibold">Recent transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="eth-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Tx hash</th>
                    <th>Block</th>
                    <th className="text-right">Age</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Method</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.hash}>
                      <td>
                        <Link href={`/explorer/tx/${t.hash}`} className="mono text-[#9ea4ff] hover:underline">
                          {short(t.hash, 8, 6)}
                        </Link>
                      </td>
                      <td>
                        {t.blockNumber != null && (
                          <Link href={`/explorer/block/${t.blockNumber}`} className="mono text-[#9ea4ff] hover:underline">
                            {t.blockNumber.toString()}
                          </Link>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap text-zinc-400">
                        {age(t.blockNumber ?? undefined)}
                      </td>
                      <td className="mono text-xs text-zinc-300">{labelFor(t.from)}</td>
                      <td className="mono text-xs text-zinc-300">{labelFor(t.to || "")}</td>
                      <td>
                        <MethodBadge call={t.decoded} input={t.decoded.raw} />
                      </td>
                      <td className="mono text-right text-xs text-amber-300">
                        {t.value > 0n ? `${formatEtherNative(t.value)} ETH` : "—"}
                      </td>
                      <td className="text-right">
                        <StatusPill status={t.status} />
                      </td>
                    </tr>
                  ))}
                  {txs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-center text-xs text-zinc-600">
        Hashes resolve to{" "}
        <Link className="eth-link" href="/explorer">
          /explorer/tx/…
        </Link>{" "}
        · blocks to{" "}
        <Link className="eth-link" href="/explorer">
          /explorer/block/…
        </Link>
      </p>
    </div>
  );
}