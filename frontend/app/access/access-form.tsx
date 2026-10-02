"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function AccessForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("Wrong password. Try again.");
      setLoading(false);
      return;
    }
    const next = searchParams.get("next") || "/";
    window.location.assign(next.startsWith("/") ? next : "/");
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-3 text-left">
      <label htmlFor="team-password" className="text-sm font-medium text-zinc-200">
        Shared password
      </label>
      <input
        id="team-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#8b92ff]"
        placeholder="Enter team password"
      />
      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="eth-btn mt-2 w-full justify-center bg-white py-3 font-semibold text-zinc-950 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Checking…" : "Continue to BlockDNS"}
      </button>
    </form>
  );
}
