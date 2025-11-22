// src/app/page.js
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* -----------------------------
   Dummy Transactions (schema)
   Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country
   ----------------------------- */
const dummyTransactions = [
  {
    Invoice: 489434,
    StockCode: "85048",
    Description: "15CM CHRISTMAS GLASS",
    Quantity: 12,
    InvoiceDate: "2009-12-01 07:45:00",
    Price: 6.95,
    CustomerID: "13085",
    Country: "United Kingdom",
  },
  {
    Invoice: 489434,
    StockCode: "79323P",
    Description: "PINK CHERRY LIGHTS",
    Quantity: 12,
    InvoiceDate: "2009-12-01 07:45:00",
    Price: 6.75,
    CustomerID: "13085",
    Country: "United Kingdom",
  },
  {
    Invoice: 489435,
    StockCode: "22041",
    Description: 'RECORD FRAME 7" SINGLE',
    Quantity: 48,
    InvoiceDate: "2009-12-02 09:12:00",
    Price: 2.1,
    CustomerID: "14320",
    Country: "United Kingdom",
  },
  {
    Invoice: 489436,
    StockCode: "21232",
    Description: "STRAWBERRY CERAMIC",
    Quantity: 24,
    InvoiceDate: "2009-12-03 11:03:00",
    Price: 1.25,
    CustomerID: "13090",
    Country: "United Kingdom",
  },
  {
    Invoice: 489437,
    StockCode: "22350",
    Description: "CAT BOWL",
    Quantity: 12,
    InvoiceDate: "2009-12-04 14:21:00",
    Price: 2.55,
    CustomerID: "13085",
    Country: "United Kingdom",
  },
  {
    Invoice: 600001,
    StockCode: "50001",
    Description: "WOODEN TOY CAR",
    Quantity: 3,
    InvoiceDate: "2025-11-01 10:00:00",
    Price: 15.0,
    CustomerID: "CUST-0001",
    Country: "United Kingdom",
  },
  {
    Invoice: 600002,
    StockCode: "50002",
    Description: "SPORTS WATER BOTTLE",
    Quantity: 5,
    InvoiceDate: "2025-11-08 12:00:00",
    Price: 8.5,
    CustomerID: "CUST-0002",
    Country: "United Kingdom",
  },
  {
    Invoice: 600003,
    StockCode: "50003",
    Description: "LUX SOFA CUSHION",
    Quantity: 1,
    InvoiceDate: "2025-11-15 09:30:00",
    Price: 45.0,
    CustomerID: "CUST-0003",
    Country: "United Kingdom",
  },
  {
    Invoice: 600004,
    StockCode: "50004",
    Description: "ELECTRIC KETTLE",
    Quantity: 2,
    InvoiceDate: "2025-11-22 15:44:00",
    Price: 32.0,
    CustomerID: "CUST-0002",
    Country: "United Kingdom",
  },
];

/* -----------------------------
   Emerald Mint Theme (reused)
   ----------------------------- */
const THEME = {
  bg: "#f3fdfa",
  bgSecondary: "#e2faf1",
  cardBorder: "#c9efe4",
  accent: "#10b981",
  accentSoft: "#34d399",
  chart: ["#10b981", "#0ea5e9", "#f59e0b", "#6366f1", "#7c3aed", "#ef4444"],
  // shadow tints for different card types
  shadows: {
    mint: "rgba(16,185,129,0.16)",
    blue: "rgba(11,132,255,0.16)",
    purple: "rgba(124,58,237,0.14)",
    amber: "rgba(245,158,11,0.14)",
  },
};

/* -----------------------------
   Helpers
   ----------------------------- */
const currency = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v
  );

function aggregateWeekly(transactions) {
  const map = {};
  transactions.forEach((t) => {
    const d = new Date(t.InvoiceDate);
    if (isNaN(d)) return;
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    const sale = (t.Price || 0) * (t.Quantity || 0);
    map[key] = (map[key] || 0) + sale;
  });
  return Object.keys(map)
    .sort()
    .map((k) => ({ week: k, sales: Math.round(map[k]) }));
}

function simpleForecast(weekly) {
  const last = weekly.slice(-4).map((w) => w.sales);
  const avg = Math.round(
    (last.reduce((s, x) => s + x, 0) || 0) / (last.length || 1)
  );
  const out = [];
  const start = weekly.length
    ? new Date(weekly[weekly.length - 1].week)
    : new Date();
  for (let i = 1; i <= 4; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + 7 * i);
    out.push({
      week: dt.toISOString().slice(0, 10),
      sales: Math.round(avg * (1 + 0.03 * i)),
    });
  }
  return out;
}

function paginated(arr, page, per) {
  const start = (page - 1) * per;
  return arr.slice(start, start + per);
}

const lift = (shadow) => ({
  boxShadow: `0 28px 60px ${shadow}`,
  y: -6,
  transition: { duration: 0.22, ease: "easeOut" },
});

/* -----------------------------
   Main component
   ----------------------------- */
export default function Page() {
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [q, setQ] = useState("");
  const txs = dummyTransactions;

  // Filtered transactions (search)
  const filtered = useMemo(() => {
    if (!q) return txs;
    const s = q.trim().toLowerCase();
    return txs.filter((r) => {
      return (
        String(r.Invoice).toLowerCase().includes(s) ||
        (r.StockCode || "").toLowerCase().includes(s) ||
        (r.Description || "").toLowerCase().includes(s) ||
        (r.CustomerID || "").toLowerCase().includes(s)
      );
    });
  }, [q, txs]);

  const weekly = useMemo(() => aggregateWeekly(filtered), [filtered]);
  const forecast = useMemo(() => simpleForecast(weekly), [weekly]);
  const showSkeleton = filtered.length === 0;

  // RFM-lite top customers
  const customerMap = {};
  filtered.forEach((t) => {
    const id = t.CustomerID || "unknown";
    const amount = (t.Price || 0) * (t.Quantity || 0);
    if (!customerMap[id])
      customerMap[id] = { id, total: 0, orders: 0, last: null };
    customerMap[id].total += amount;
    customerMap[id].orders += 1;
    const d = new Date(t.InvoiceDate);
    if (!customerMap[id].last || d > customerMap[id].last)
      customerMap[id].last = d;
  });
  const segments = Object.values(customerMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const pieData = segments.length
    ? segments.map((s) => ({
        name: s.id,
        value: Math.max(1, Math.round(s.total)),
      }))
    : [{ name: "No data", value: 1 }];
  const COLORS = THEME.chart;

  // Responsive legend: small screens show stacked legend below chart; larger screens show inline.
  const [legendLayout, setLegendLayout] = useState("horizontal");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-black via-zinc-900 to-zinc-950 text-zinc-50 antialiased px-4 sm:px-6 lg:px-10 py-8 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_55%)] before:opacity-80 before:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.18),transparent_45%)] after:blur-[120px] after:pointer-events-none">
      <div className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 10% 20%, rgba(16,185,129,0.25) 0, transparent 35%), radial-gradient(circle at 80% 10%, rgba(37,99,235,0.18) 0, transparent 40%), radial-gradient(circle at 60% 80%, rgba(76,29,149,0.2) 0, transparent 45%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:120px_120px] [animation:pulse_12s_linear_infinite]" />
      <div className="max-w-[1250px] mx-auto relative z-10 space-y-8">
        {/* header */}
        <header className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 rounded-3xl border border-white/10 bg-zinc-900/70 backdrop-blur-md px-6 py-6 shadow-[0_0_100px_rgba(16,185,129,0.12)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/5 before:opacity-70 before:pointer-events-none after:absolute after:bottom-2 after:left-8 after:right-8 after:h-[2px] after:bg-gradient-to-r from-emerald-400/70 via-cyan-300/70 to-teal-300/70 after:blur-sm after:opacity-80">
          <div className="flex items-start gap-4 relative z-[1]">
            <div
              className="w-14 h-14 rounded-3xl flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-zinc-950 border border-white/10 shadow-[0_20px_70px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/30"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="#d4d4d8"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="relative z-[1]">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_8px_35px_rgba(0,0,0,0.65)]">
                ChainForecast
              </h1>
              <p className="text-sm sm:text-base text-zinc-300 mt-2 tracking-[0.15em]">
                Dark ops console — responsive analytics, neon accents & precision controls
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-4 mt-3 md:mt-0 relative z-[1]">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/crm-segmentation"
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition-all duration-300 hover:scale-[1.02]"
              >
                CRM
              </Link>
              <Link
                href="/blockchain-integrity"
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200 transition-all duration-300 hover:scale-[1.02]"
              >
                Blockchain
              </Link>
            </div>
            <div className="flex-1 md:flex-none">
              <label htmlFor="search" className="sr-only">
                Search transactions
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-200/80">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="opacity-80"
                  >
                    <path
                      d="M11 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm6 10 2.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <input
                  id="search"
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  placeholder="Search invoice, stock, description, or customer..."
                  className="w-full md:w-[420px] rounded-2xl border border-white/10 bg-zinc-950/80 pl-10 pr-14 py-3 text-sm sm:text-base text-white shadow-[inset_0_0_20px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out placeholder:text-zinc-500 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/50 hover:ring-1 hover:ring-emerald-300/40"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-emerald-100 bg-white/5 rounded-xl px-2 py-0.5 border border-white/10">
                  ⌘K
                </div>
              </div>
            </div>

            <button
              aria-label="Connect"
              className="inline-flex items-center gap-2 rounded-3xl px-5 py-3 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_35px_rgba(16,185,129,0.5)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] active:scale-[0.97]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium">Connect</span>
            </button>
          </div>
        </header>

        {/* feature shortcuts */}
        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/crm-segmentation"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-[0_0_80px_rgba(16,185,129,0.15)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
                  CRM Analytics
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Launch Segmentation Console
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Dive into RFM insights, segment summaries, and tailored offers powered by the Flask API.
                </p>
              </div>
              <div className="ml-4 text-emerald-300 group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </Link>

          <Link
            href="/blockchain-integrity"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-[0_0_80px_rgba(14,165,233,0.15)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(14,165,233,0.35)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/80">
                  Integrity Module
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Verify Dataset Hashes
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Inspect SHA256 fingerprints and Merkle roots to prove data authenticity.
                </p>
              </div>
              <div className="ml-4 text-cyan-300 group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </Link>
        </div>

        {/* grid */}
        <main className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* left: charts + table */}
          <section className="md:col-span-2 space-y-6">
            {/* forecast card (mint shadow) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.mint)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),transparent_60%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-emerald-300/80 mb-2">
                    Performance Pulse
                  </p>
                  <h2 className="text-lg md:text-2xl font-semibold text-white drop-shadow-[0_5px_30px_rgba(16,185,129,0.35)]">
                    Weekly Sales & Forecast
                  </h2>
                  <p className="text-sm md:text-base text-zinc-400 mt-1 max-w-xl leading-relaxed">
                    Aggregated sales + simple 4-week forecast (derived from
                    visible transactions).
                  </p>
                </div>

                <div className="w-full md:w-64">
                  <div
                    className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_80px_rgba(16,185,129,0.35)]"
                  >
                    <div className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
                      Forecast (4w)
                    </div>
                    <div className="text-4xl font-semibold mt-2 text-white drop-shadow-[0_5px_25px_rgba(16,185,129,0.35)] animate-[pulse_3s_ease-in-out_infinite]">
                      {currency(forecast.reduce((s, x) => s + x.sales, 0))}
                    </div>
                    <div className="text-xs text-zinc-400 mt-2">
                      Avg weekly: {" "}
                      {currency(
                        Math.round(
                          forecast.reduce((s, x) => s + x.sales, 0) /
                            forecast.length || 0
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {showSkeleton ? (
                <div className="mt-8 space-y-4">
                  <div className="h-48 rounded-3xl bg-gradient-to-r from-zinc-900/70 via-zinc-800/40 to-zinc-900/70 bg-[length:200%_100%] animate-[pulse_2s_ease-in-out_infinite]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-3 rounded-full bg-zinc-700/80" />
                    <div className="h-3 rounded-full bg-zinc-700/80" />
                    <div className="h-3 rounded-full bg-zinc-700/80 col-span-2" />
                  </div>
                </div>
              ) : (
                <div className="mt-6 relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 p-4 shadow-[0_0_90px_rgba(16,185,129,0.18)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.3)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.35),transparent_60%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500">
                  <div style={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={[...weekly, ...forecast].slice(-12)}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#1f2937" />
                        <XAxis
                          dataKey="week"
                          stroke="#94a3b8"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v) => currency(v)}
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid rgba(148,163,184,0.3)",
                            color: "#f8fafc",
                          }}
                          itemStyle={{ color: "#f8fafc" }}
                        />
                        <Line
                          dataKey="sales"
                          stroke={THEME.accent}
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </motion.div>

            {/* transactions table (blue shadow on hover) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.blue)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),transparent_55%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h3 className="text-xl font-semibold text-white tracking-tight drop-shadow-[0_0_35px_rgba(16,185,129,0.35)]">
                  Transactions
                </h3>
                <div className="text-sm text-zinc-400">
                  Filtered rows: {filtered.length}
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/70 ring-1 ring-white/5 transition-all duration-300 ease-out hover:scale-[1.01]">
                <table className="w-full text-sm text-zinc-200">
                  <thead>
                    <tr
                      className="text-left text-[0.7rem] uppercase tracking-[0.3em] text-zinc-500 bg-white/5"
                    >
                      <th className="py-3 pr-4 border-b border-white/10">Invoice</th>
                      <th className="py-3 pr-4 border-b border-white/10">StockCode</th>
                      <th className="py-3 pr-4 border-b border-white/10">Description</th>
                      <th className="py-3 pr-4 text-right border-b border-white/10">Qty</th>
                      <th className="py-3 pr-4 border-b border-white/10">InvoiceDate</th>
                      <th className="py-3 pr-4 border-b border-white/10">Price</th>
                      <th className="py-3 pr-4 border-b border-white/10">CustomerID</th>
                      <th className="py-3 pr-4 border-b border-white/10">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showSkeleton
                      ? Array.from({ length: perPage }).map((_, idx) => (
                          <tr key={idx} className="border-b border-white/5 last:border-b-0">
                            {Array.from({ length: 8 }).map((_, cellIdx) => (
                              <td key={cellIdx} className="py-3 pr-4">
                                <div className="h-3 w-24 rounded-full bg-zinc-800/70 animate-[pulse_1.4s_ease-in-out_infinite]" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : paginated(filtered, page, perPage).map((r, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-white/5 last:border-b-0 bg-transparent odd:bg-zinc-950/50 even:bg-transparent border-l-4 border-transparent transition-all duration-500 ease-out hover:bg-emerald-500/5 hover:border-l-4 hover:border-emerald-400/70 hover:shadow-[0_0_140px_rgba(16,185,129,0.3)] hover:scale-[1.02] hover:-translate-y-1"
                          >
                            <td className="py-3 pr-4 font-medium text-white">
                              {r.Invoice}
                            </td>
                            <td className="py-3 pr-4 text-zinc-300">{r.StockCode}</td>
                            <td
                              className="py-3 pr-4 max-w-[320px] truncate text-zinc-400"
                              title={r.Description}
                            >
                              {r.Description}
                            </td>
                            <td className="py-3 pr-4 text-right text-zinc-300">
                              {r.Quantity}
                            </td>
                            <td className="py-3 pr-4 text-zinc-300">
                              {r.InvoiceDate}
                            </td>
                            <td className="py-3 pr-4 font-semibold text-white">
                              {currency(r.Price)}
                            </td>
                            <td className="py-3 pr-4 text-zinc-300">{r.CustomerID}</td>
                            <td className="py-3 pr-4 text-zinc-300">{r.Country}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-zinc-400">
                  Showing {" "}
                  {Math.min(perPage, filtered.length - (page - 1) * perPage)} of {" "}
                  {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-sm rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] active:scale-[0.97]"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] active:scale-[0.97]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </motion.div>
          </section>

          {/* right column (purple / amber shadows for variety) */}
          <aside className="space-y-6">
            {/* top customers (purple tint) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.purple)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),transparent_60%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                  VIP Segments
                </h4>
                <div className="text-xs text-zinc-400">CRM</div>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                Top Customers (by spend)
              </div>
              <div className="mt-4 space-y-3">
                {segments.length === 0
                  ? Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 p-3"
                      >
                        <div className="space-y-2 w-full animate-pulse">
                          <div className="h-3 w-32 rounded-full bg-zinc-700/70" />
                          <div className="h-3 w-48 rounded-full bg-zinc-700/70" />
                        </div>
                      </div>
                    ))
                  : segments.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5/10 p-3 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 hover:border-emerald-300/60 hover:shadow-[0_0_60px_rgba(16,185,129,0.35)]"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {s.id}
                          </div>
                          <div className="text-xs text-zinc-400">
                            Orders: {s.orders} • Last: {" "}
                            {s.last?.toISOString().slice(0, 10)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {currency(s.total)}
                        </div>
                      </div>
                    ))}
              </div>
            </motion.div>

            {/* top offer (amber tint) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.amber)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.18),transparent_55%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <h5 className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                Activation
              </h5>
              <div className="text-2xl font-semibold text-white drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                Top Segment Offer
              </div>
              <div
                className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 ring-1 ring-white/5"
              >
                {segments.length === 0 ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-32 rounded-full bg-zinc-700/70" />
                    <div className="h-3 w-48 rounded-full bg-zinc-700/70" />
                    <div className="h-10 rounded-xl bg-zinc-800/80" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">
                          {segments[0]?.id || "—"}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          {segments[0]
                            ? `${segments[0].orders} orders • Avg ${currency(
                                Math.round(
                                  segments[0].total /
                                    Math.max(1, segments[0].orders)
                                )
                              )}`
                            : ""}
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wide text-emerald-200 bg-emerald-500/10 border border-emerald-400/40">
                        Suggested
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-zinc-400 leading-relaxed">
                      Top customers: VIP offers, bundle discounts, or free
                      shipping are effective.
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button
                        className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:brightness-110 hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] active:scale-[0.97]"
                      >
                        Send Offer
                      </button>
                      <button
                        className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-500 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:text-white hover:border-emerald-300/60 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-[0.97]"
                      >
                        Preview
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* data integrity (mint shadow) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.mint)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),transparent_60%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <h5 className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                Integrity
              </h5>
              <div className="text-2xl font-semibold text-white drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                Data Integrity
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                Merkle Root (simulated)
              </p>

              <div
                className="mt-2 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-xs font-mono tracking-tight text-emerald-200 shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]"
              >
                a3f1c9c6d8a1b2e3f4d5c6b7a8e9f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6
              </div>
              <div className="text-xs text-zinc-400 mt-2">
                Timestamp: {new Date().toLocaleString()}
              </div>
            </motion.div>

            {/* segment distribution (pie) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.blue)}
              className="relative group overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_0_100px_rgba(16,185,129,0.12)] backdrop-blur-md transition-all duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_0_140px_rgba(16,185,129,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),transparent_55%)] before:opacity-0 group-hover:opacity-80 before:transition-opacity before:duration-500"
            >
              <h6 className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                Segments
              </h6>
              <div className="text-xl font-semibold text-white drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]">
                Segment Distribution
              </div>

              <div style={{ width: "100%", height: 180 }} className="mt-3">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={64}
                      paddingAngle={6}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{
                        color: "#e5e7eb",
                        fontSize: 12,
                        paddingTop: 8,
                      }}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* responsive caption for small screens - optional */}
              <div className="mt-2 text-xs text-zinc-400">
                Legend placed below chart for clarity on small screens.
              </div>
            </motion.div>
          </aside>
        </main>

        <footer className="mt-8 text-center text-xs text-zinc-500">
          Updated UI • screenshot used: {" "}
          <code>/mnt/data/b9b5d9bf-b797-48a6-bf21-b49a23369aa6.png</code>
        </footer>
      </div>
    </div>
  );
}
