import { Suspense } from "react";
import MintClient from "@/components/MintClient";

export default async function MintPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 pt-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Mint your <span className="text-violet-400">.bdns</span> domain
        </h1>
        <p className="mt-2 text-zinc-400">
          5+ characters free · short premium names one-time — lifetime ownership, forever.
        </p>
      </div>

      <Suspense fallback={null}>
        <MintClient initialName={name ?? ""} />
      </Suspense>
    </div>
  );
}