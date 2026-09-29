"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Globe,
  Loader2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useBlockDNS, type DomainInfo } from "@/hooks/useBlockDNS";
import { ipfsUrl, txLink } from "@/lib/constants";
import { shortAddress } from "@/lib/format";
import IPFSUploader from "@/components/IPFSUploader";
import SellDomain from "@/components/SellDomain";
import WalletBadge from "@/components/WalletBadge";

const CHAINS = ["ETH", "BTC", "SOL"] as const;

export default function DomainCard({
  domain,
  onSold,
}: {
  domain: DomainInfo;
  onSold?: () => void;
}) {
  const { setIPFSRecord, setAddressRecord, readRecord, txHash, txPending, txError, txErrorMessage, resetTx } =
    useBlockDNS();

  const [records, setRecords] = useState({ cid: domain.ipfsCID, ETH: "", BTC: "", SOL: "" });
  const [editCid, setEditCid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function loadRecords(initial = false) {
    const next = await readRecord(domain.tokenId);
    setRecords({ cid: next.cid || domain.ipfsCID, ETH: next.ETH, BTC: next.BTC, SOL: next.SOL });
    if (initial && next.cid) setEditCid(false);
  }

  useEffect(() => {
    void loadRecords(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.tokenId]);

  useEffect(() => {
    if (txHash && !txPending) {
      setSaving(false);
      setJustSaved(true);
      const t = setTimeout(() => {
        setJustSaved(false);
        void loadRecords();
      }, 900);
      return () => clearTimeout(t);
    }
  }, [txHash, txPending]);

  async function saveAddr(chain: string, addr: string) {
    setSaving(true);
    resetTx();
    try {
      await setAddressRecord(domain.tokenId, chain, addr.trim());
    } catch {
      setSaving(false);
    }
  }

  async function saveCid(cid: string) {
    setSaving(true);
    resetTx();
    try {
      await setIPFSRecord(domain.tokenId, cid);
      setEditCid(false);
    } catch {
      setSaving(false);
    }
  }

  const pendingHash = txHash;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-3xl border border-white/10 bg-zinc-900/80 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {domain.name}
            <span className="text-violet-400">.bdns</span>
          </p>
          <p className="font-mono text-xs text-zinc-500">#{domain.tokenId.toString()}</p>
          <div className="mt-2">
            <WalletBadge address={domain.owner} label="Owner" />
          </div>
        </div>
        <a
          href={`https://${domain.name}.bdns`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-white"
        >
          <Globe size={14} className="mr-1 inline" />
          www
        </a>
      </div>

      {!editCid ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
          {records.cid ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={ipfsUrl(records.cid)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-mono text-xs text-emerald-400 hover:text-emerald-300"
              >
                <ExternalLink size={12} /> IPFS · {records.cid.slice(0, 14)}…
              </a>
              <button
                onClick={() => setEditCid(true)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Update
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">No IPFS content pinned yet.</p>
              <button
                onClick={() => setEditCid(true)}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Pin your site →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <IPFSUploader
            onUploaded={(cid) => {
              void saveCid(cid);
            }}
          />
          <button
            onClick={() => setEditCid(false)}
            className="mt-2 text-xs text-zinc-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {CHAINS.map((chain) => (
          <AddressField
            key={chain}
            chain={chain}
            value={records[chain]}
            disabled={txPending}
            onSave={(addr) => void saveAddr(chain, addr)}
          />
        ))}
      </div>

      <SellDomain
        tokenId={domain.tokenId}
        name={domain.name}
        onChanged={() => onSold?.()}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        {saving && (
          <span className="flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> confirming…
          </span>
        )}
        {justSaved && <span className="text-emerald-400">Saved ✓</span>}
        {!saving && !justSaved && <span>Gas-paid on-chain · no renewals, ever</span>}
        {pendingHash && !txPending && (
          <a
            href={txLink(pendingHash)}
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 hover:text-violet-300"
          >
            tx ↗
          </a>
        )}
      </div>

      {txError && (
        <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <XCircle size={12} className="mr-1 inline" /> {txErrorMessage}
        </p>
      )}
    </motion.div>
  );
}

function AddressField({
  chain,
  value,
  disabled,
  onSave,
}: {
  chain: string;
  value: string;
  disabled: boolean;
  onSave: (addr: string) => void;
}) {
  const [raw, setRaw] = useState(value);
  useEffect(() => setRaw(value), [value]);
  const [busy, setBusy] = useState(false);
  const savedValue = value;

  async function commit() {
    setBusy(true);
    try {
      await onSave(raw);
    } finally {
      setBusy(false);
    }
  }

  const buttonActive = raw.trim() && raw.trim() !== savedValue && !disabled;

  return (
    <div className="flex items-center gap-3">
      <span className="flex w-12 shrink-0 items-center gap-1.5 text-xs font-semibold text-zinc-400">
        <Wallet size={12} className="text-zinc-500" /> {chain}
      </span>
      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && buttonActive && void commit()}
        placeholder={`${shortAddress("0x0000000000000000000000000000000000000000")} or ${chain} address`}
        disabled={disabled}
        className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-xs text-zinc-200 outline-none transition-colors focus:border-violet-500/60 disabled:opacity-50"
      />
      <button
        onClick={() => void commit()}
        disabled={!buttonActive}
        className="shrink-0 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : "Set"}
      </button>
    </div>
  );
}