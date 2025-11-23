"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5001/";

export default function BlockchainIntegrityPage() {
  const [blockchainData, setBlockchainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/blockchain`);
        if (!res.ok) throw new Error("Failed to fetch blockchain data");
        const data = await res.json();
        setBlockchainData(data);
      } catch (err) {
        setError(err.message || "Unexpected error");
        setBlockchainData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-6 lg:px-12 py-10">
      <section className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-emerald-300/80 text-xs uppercase tracking-[0.4em]">
              Data Integrity
            </p>
            <h1 className="text-4xl font-black tracking-tight mt-2">
              Blockchain Verification
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl">
              Verify the authenticity and integrity of your CRM data through blockchain-based hashing.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-semibold shadow-xl ring-1 ring-emerald-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                  File Hash
                </p>
                <h2 className="text-2xl font-semibold mt-2">SHA256 Fingerprint</h2>
              </div>
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="h-6 w-full rounded bg-zinc-800 animate-pulse" />
              ) : error ? (
                <div className="text-rose-400">{error}</div>
              ) : blockchainData ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm break-all">
                  {blockchainData.file_hash}
                </div>
              ) : (
                <div className="text-zinc-500">No data available</div>
              )}
            </div>
            <p className="text-zinc-400 text-sm mt-3">
              This SHA256 hash represents the cryptographic fingerprint of your entire dataset file.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                  Merkle Root
                </p>
                <h2 className="text-2xl font-semibold mt-2">Transaction Tree</h2>
              </div>
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="h-6 w-full rounded bg-zinc-800 animate-pulse" />
              ) : error ? (
                <div className="text-rose-400">{error}</div>
              ) : blockchainData ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm break-all">
                  {blockchainData.merkle_root}
                </div>
              ) : (
                <div className="text-zinc-500">No data available</div>
              )}
            </div>
            <p className="text-zinc-400 text-sm mt-3">
              The Merkle root provides a compact representation of all individual transactions.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                Verification Process
              </p>
              <h2 className="text-2xl font-semibold mt-1">How It Works</h2>
            </div>
          </div>
          
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <div className="text-emerald-400 text-2xl font-bold mb-3">1</div>
              <h3 className="font-semibold text-lg mb-2">Data Hashing</h3>
              <p className="text-zinc-400 text-sm">
                Each transaction is cryptographically hashed using SHA256 algorithm.
              </p>
            </div>
            
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <div className="text-emerald-400 text-2xl font-bold mb-3">2</div>
              <h3 className="font-semibold text-lg mb-2">Merkle Tree</h3>
              <p className="text-zinc-400 text-sm">
                Hashes are combined in pairs to form a binary tree structure.
              </p>
            </div>
            
            <div className="rounded-2xl border border-white/5 bg-black/20 p-5">
              <div className="text-emerald-400 text-2xl font-bold mb-3">3</div>
              <h3 className="font-semibold text-lg mb-2">Immutable Record</h3>
              <p className="text-zinc-400 text-sm">
                The Merkle root can be stored on-chain for tamper-proof verification.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}