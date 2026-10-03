import { Suspense } from "react";
import { AccessForm } from "./access-form";

export default function AccessPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center py-12">
      <section className="eth-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#5964ff]/15 text-2xl text-[#b6bdff]">
          BD
        </div>
        <p className="mono text-xs uppercase tracking-[0.24em] text-[#8b92ff]">Private workspace</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Team access</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Enter the shared team password to open BlockDNS.
        </p>
        <Suspense fallback={<div className="mt-7 h-32" aria-hidden="true" />}>
          <AccessForm />
        </Suspense>
      </section>
    </main>
  );
}
