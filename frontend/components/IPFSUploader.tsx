"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileUp, Link2, Loader2, CheckCircle2 } from "lucide-react";
import { pinFileToIPFS } from "@/lib/ipfs";
import { ipfsUrl } from "@/lib/constants";

type Props = {
  onUploaded: (cid: string) => void;
};

const CID_RE =
  /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|k[A-Za-z0-9]{58}|z[A-Za-z0-9]{59})$/;

export default function IPFSUploader({ onUploaded }: Props) {
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [manual, setManual] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("text/") && !file.type.startsWith("image/")) {
      setError("Only text or image files can be pinned right now.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await pinFileToIPFS(file);
      setCid(next);
      onUploaded(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function bindManual() {
    const value = manual.trim();
    if (!value) return;
    if (!CID_RE.test(value)) {
      setError("That doesn't look like an IPFS CID (Qm…, bafy…, etc.).");
      return;
    }
    setError(null);
    setCid(value);
    onUploaded(value);
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors ${
          drag
            ? "border-violet-500/70 bg-violet-500/10"
            : "border-white/15 bg-zinc-900/50 hover:border-white/25"
        }`}
      >
        <input
          type="file"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          aria-label="Choose file to pin to IPFS"
        />
        {busy ? (
          <Loader2 size={22} className="animate-spin text-violet-400" />
        ) : (
          <FileUp size={22} className="text-zinc-400" />
        )}
        <p className="text-sm text-zinc-400">
          {busy ? "Pinning to IPFS…" : "Drop a file or click to pin it to IPFS"}
        </p>
        {cid && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 font-mono text-xs text-emerald-400"
          >
            <Link2 size={12} /> {cid}
          </motion.span>
        )}
      </label>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") bindManual();
          }}
          placeholder="Or paste a CID already on IPFS…"
          className="w-full rounded-xl border border-white/15 bg-zinc-900/50 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
        />
        <button
          onClick={bindManual}
          disabled={!manual.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600/90 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 size={14} /> Bind
        </button>
      </div>

      {cid && (
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Pinned ✓</span>
          <a
            href={ipfsUrl(cid)}
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 hover:text-violet-300"
          >
            View on gateway →
          </a>
        </div>
      )}
    </div>
  );
}