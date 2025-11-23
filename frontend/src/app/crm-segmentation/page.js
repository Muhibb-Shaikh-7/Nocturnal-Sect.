"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5001/";
const SEGMENT_COLORS = ["#34d399", "#22d3ee", "#a855f7", "#f97316", "#facc15"];

export default function CrmSegmentationPage() {
  const [summary, setSummary] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/segments`);
        if (!res.ok) throw new Error("Failed to fetch segments");
        const data = await res.json();
        setSummary(data.summary || []);
        setCustomers(data.customers || []);
      } catch (err) {
        setError(err.message || "Unexpected error");
        // Set empty arrays to ensure UI handles empty data gracefully
        setSummary([]);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const bestSegment = useMemo(() => {
    if (!summary.length) return null;
    return [...summary].sort((a, b) => b.count - a.count)[0];
  }, [summary]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-6 lg:px-12 py-10">
      <section className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-emerald-300/80 text-xs uppercase tracking-[0.4em]">
              CRM Analytics
            </p>
            <h1 className="text-4xl font-black tracking-tight mt-2">
              RFM Segmentation Console
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl">
              Monitor customer health, highlight critical segments, and launch AI-assist offers in seconds.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-semibold shadow-xl ring-1 ring-emerald-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
          >
            Upload Data →
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(loading ? Array.from({ length: 3 }) : summary).map((segment, idx) => (
            <div
              key={segment?.segment || idx}
              className={`rounded-2xl border border-white/10 bg-zinc-900/60 p-5 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:border-emerald-300/50 ${
                bestSegment && segment?.segment === bestSegment.segment
                  ? "ring-1 ring-emerald-400"
                  : ""
              } ${loading ? "animate-pulse" : ""}`}
            >
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-1/2 rounded bg-zinc-800" />
                  <div className="h-8 w-1/3 rounded bg-zinc-800" />
                  <div className="h-3 w-2/3 rounded bg-zinc-800" />
                </div>
              ) : segment ? (
                <>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                    {segment.segment}
                  </p>
                  <h3 className="text-3xl font-semibold mt-3">{segment.count}</h3>
                  <p className="text-zinc-400 text-sm mt-2">
                    Offer: <span className="text-emerald-300">{segment.suggested_offer}</span>
                  </p>
                </>
              ) : (
                <div className="text-zinc-500">No data available</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                  Distribution
                </p>
                <h2 className="text-2xl font-semibold mt-2">Segment Mix</h2>
              </div>
            </div>
            <div className="mt-4 h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                </div>
              ) : summary.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={summary} dataKey="count" nameKey="segment" innerRadius={70} outerRadius={110} paddingAngle={4}>
                      {summary.map((entry, idx) => (
                        <Cell key={entry.segment} fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                  Highlights
                </p>
                <h2 className="text-2xl font-semibold mt-2">Best Performing Segment</h2>
              </div>
            </div>
            {loading ? (
              <div className="mt-6 space-y-4">
                <div className="h-8 w-1/2 rounded bg-zinc-800 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-zinc-800 animate-pulse" />
                <div className="h-16 rounded-xl bg-zinc-800/50 animate-pulse" />
              </div>
            ) : bestSegment ? (
              <div className="mt-6 space-y-4">
                <h3 className="text-3xl font-bold">{bestSegment.segment}</h3>
                <p className="text-zinc-400">
                  {bestSegment.count} active accounts • Offer: {bestSegment.suggested_offer}
                </p>
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4 text-sm text-emerald-100">
                  Deploy the recommended incentive now to maximize conversion before end of quarter.
                </div>
              </div>
            ) : (
              <div className="mt-6 text-zinc-500">No data available</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">
                Customer Table
              </p>
              <h2 className="text-2xl font-semibold mt-1">Segmented Accounts</h2>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-400 text-[0.7rem] uppercase tracking-[0.35em]">
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Segment</th>
                  <th className="py-3 pr-4">Recency</th>
                  <th className="py-3 pr-4">Frequency</th>
                  <th className="py-3 pr-4">Monetary</th>
                  <th className="py-3 pr-4">Offer</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="border-t border-white/5">
                      <td colSpan={6} className="py-3">
                        <div className="h-4 rounded bg-zinc-800 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : customers.length > 0 ? (
                  customers.map((customer, idx) => (
                    <tr
                      key={customer.CustomerID || idx}
                      className="border-t border-white/5 transition-all duration-300 hover:bg-emerald-500/5"
                    >
                      <td className="py-3 pr-4 font-semibold">{customer.CustomerID}</td>
                      <td className="py-3 pr-4 text-emerald-200">{customer.segment}</td>
                      <td className="py-3 pr-4 text-zinc-300">{customer.recency} days</td>
                      <td className="py-3 pr-4 text-zinc-300">{customer.frequency}</td>
                      <td className="py-3 pr-4 text-zinc-200">${customer.monetary?.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-emerald-300">{customer.offer}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      No customer data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {!loading && !customers.length && (
              <div className="py-6 text-center text-zinc-500">No customers available.</div>
            )}
            {error && <div className="py-4 text-rose-400">{error}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}