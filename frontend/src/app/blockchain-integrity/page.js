"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5050";

export default function BlockchainIntegrityPage() {
  const [integrity, setIntegrity] = useState({ file_hash: "", merkle_root: "" });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadIntegrity = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/blockchain`);
        if (!res.ok) throw new Error("Failed to load blockchain integrity");
        const data = await res.json();
        setIntegrity(data);
      } catch (err) {
        setError(err.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    loadIntegrity();
  }, []);

  const copyValue = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(""), 2000);
    } catch (err) {
      setError("Unable to copy to clipboard");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-6 lg:px-12 py-10">
      <section className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-cyan-300/80 text-xs uppercase tracking-[0.4em]">
              Blockchain Integrity
            </p>
            <h1 className="text-4xl font-black tracking-tight mt-2">
              Proof-of-Data Verification
            </h1>
            <p className="text-zinc-400 mt-2">
              Validate the CRM dataset with tamper-proof SHA256 fingerprints and Merkle proofs.
            </p>
          </div>
          <Link
            href="/crm-segmentation"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-semibold shadow-xl ring-1 ring-cyan-300/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
          >
            ← CRM Console
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            { label: "Dataset Hash", value: integrity.file_hash, field: "file_hash" },
            { label: "Merkle Root", value: integrity.merkle_root, field: "merkle_root" },
          ].map((item) => (
            <div
              key={item.field}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">
                {item.label}
              </p>
              <div className="mt-3 break-all font-mono text-sm text-zinc-200">
                {loading ? <div className="h-6 rounded bg-zinc-800 animate-pulse" /> : item.value || "—"}
              </div>
              <button
                disabled={!item.value}
                onClick={() => copyValue(item.value, item.field)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:border-cyan-300/60 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                Copy
                {copied === item.field && <span className="text-cyan-300">Copied!</span>}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center animate-pulse">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-6 h-6 text-cyan-300"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">
                Verification Status
              </p>
              <h2 className="text-2xl font-semibold">Dataset Anchored</h2>
              <p className="text-zinc-400 text-sm mt-1">
                Every transaction row rolls into the Merkle tree above. Recompute locally to validate authenticity.
              </p>
            </div>
          </div>
          {error && <div className="mt-4 text-rose-400">{error}</div>}
        </div>
      </section>
    </main>
  );
}
