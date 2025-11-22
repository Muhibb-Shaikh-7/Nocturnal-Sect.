// src/app/page.js
"use client";

import React, { useMemo, useState } from "react";
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
    <div
      style={{ background: THEME.bg }}
      className="min-h-screen text-slate-900 antialiased px-4 sm:px-8 py-6"
    >
      <div className="max-w-[1250px] mx-auto">
        {/* header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${THEME.bgSecondary}, #ffffff)`,
                border: `1px solid ${THEME.cardBorder}`,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="#0b1220"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                ChainForecast
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Emerald Mint theme — improved UI, search, hover colors, and
                responsiveness
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto flex items-center gap-3 mt-3 md:mt-0">
            <div className="flex-1 md:flex-none">
              <label htmlFor="search" className="sr-only">
                Search transactions
              </label>
              <div className="relative">
                <input
                  id="search"
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  placeholder="Search invoice, stock, description, or customer..."
                  className="w-full md:w-[420px] px-4 py-2 rounded-lg border"
                  style={{ borderColor: THEME.cardBorder }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  ⌘K
                </div>
              </div>
            </div>

            <button
              aria-label="Connect"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-md hover:shadow-2xl transform hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accentSoft})`,
                boxShadow: `0 8px 28px ${THEME.shadows.mint}`,
              }}
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

        {/* grid */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* left: charts + table */}
          <section className="lg:col-span-2 space-y-6">
            {/* forecast card (mint shadow) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.mint)}
              className="rounded-2xl p-6"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(12,74,55,0.04)",
              }}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold">
                    Weekly Sales & Forecast
                  </h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-xl">
                    Aggregated sales + simple 4-week forecast (derived from
                    visible transactions).
                  </p>
                </div>

                <div className="w-full md:w-64">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "#fff",
                      border: `1px solid ${THEME.cardBorder}`,
                      boxShadow: "0 4px 14px rgba(12,74,55,0.03)",
                    }}
                  >
                    <div className="text-xs text-slate-500">Forecast (4w)</div>
                    <div className="text-2xl font-semibold mt-1">
                      {currency(forecast.reduce((s, x) => s + x.sales, 0))}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Avg weekly:{" "}
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

              <div className="mt-6">
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={[...weekly, ...forecast].slice(-12)}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#ecfdf6" />
                      <XAxis
                        dataKey="week"
                        stroke="#94a3b8"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v) => currency(v)}
                        contentStyle={{
                          background: "#fff",
                          border: `1px solid ${THEME.cardBorder}`,
                        }}
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
            </motion.div>

            {/* transactions table (blue shadow on hover) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.blue)}
              className="rounded-2xl p-4"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(6,78,204,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Transactions</h3>
                <div className="text-sm text-slate-500">
                  Filtered rows: {filtered.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-xs text-slate-500 border-b"
                      style={{ borderBottomColor: "#edf9f5" }}
                    >
                      <th className="py-3 pr-4">Invoice</th>
                      <th className="py-3 pr-4">StockCode</th>
                      <th className="py-3 pr-4">Description</th>
                      <th className="py-3 pr-4">Qty</th>
                      <th className="py-3 pr-4">InvoiceDate</th>
                      <th className="py-3 pr-4">Price</th>
                      <th className="py-3 pr-4">CustomerID</th>
                      <th className="py-3 pr-4">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated(filtered, page, perPage).map((r, idx) => (
                      <tr
                        key={idx}
                        className="border-b last:border-b-0 hover:bg-[rgba(14,165,233,0.06)] transition-colors"
                      >
                        <td className="py-3 pr-4">{r.Invoice}</td>
                        <td className="py-3 pr-4">{r.StockCode}</td>
                        <td
                          className="py-3 pr-4 max-w-[320px] truncate"
                          title={r.Description}
                        >
                          {r.Description}
                        </td>
                        <td className="py-3 pr-4">{r.Quantity}</td>
                        <td className="py-3 pr-4">{r.InvoiceDate}</td>
                        <td className="py-3 pr-4">{currency(r.Price)}</td>
                        <td className="py-3 pr-4">{r.CustomerID}</td>
                        <td className="py-3 pr-4">{r.Country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Showing{" "}
                  {Math.min(perPage, filtered.length - (page - 1) * perPage)} of{" "}
                  {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 text-sm rounded"
                    style={{ border: `1px solid ${THEME.cardBorder}` }}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 text-sm rounded"
                    style={{ border: `1px solid ${THEME.cardBorder}` }}
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
              className="rounded-2xl p-4"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(99,102,241,0.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Top Customers (by spend)</h4>
                <div className="text-xs text-slate-400">CRM</div>
              </div>
              <div className="mt-3 space-y-2">
                {segments.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-[rgba(124,58,237,0.06)] transition-colors"
                  >
                    <div>
                      <div className="font-medium">{s.id}</div>
                      <div className="text-xs text-slate-500">
                        Orders: {s.orders} • Last:{" "}
                        {s.last?.toISOString().slice(0, 10)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
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
              className="rounded-2xl p-4"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(245,158,11,0.03)",
              }}
            >
              <h5 className="font-semibold">Top Segment Offer</h5>
              <div
                className="mt-3 p-3 rounded"
                style={{
                  background: THEME.bgSecondary,
                  border: `1px solid ${THEME.cardBorder}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {segments[0]?.id || "—"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
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
                  <div
                    className="px-3 py-1 rounded-md"
                    style={{
                      background: THEME.accent,
                      color: "#fff",
                      fontSize: 13,
                    }}
                  >
                    Suggested
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-700">
                  Top customers: VIP offers, bundle discounts, or free shipping
                  are effective.
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 py-2 rounded-md text-white"
                    style={{
                      background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accentSoft})`,
                      boxShadow: `0 8px 24px ${THEME.shadows.mint}`,
                    }}
                  >
                    Send Offer
                  </button>
                  <button
                    className="py-2 px-3 rounded-md border"
                    style={{ borderColor: THEME.cardBorder }}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </motion.div>

            {/* data integrity (mint shadow) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.mint)}
              className="rounded-2xl p-4"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(16,185,129,0.04)",
              }}
            >
              <h5 className="font-semibold">Data Integrity</h5>
              <p className="text-xs text-slate-500 mt-2">
                Merkle Root (simulated)
              </p>

              <div
                className="mt-2 p-3"
                style={{
                  background: "#f8fffa",
                  border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: 8,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  fontSize: 12,
                  wordBreak: "break-word",
                }}
              >
                a3f1c9c6d8a1b2e3f4d5c6b7a8e9f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Timestamp: {new Date().toLocaleString()}
              </div>
            </motion.div>

            {/* segment distribution (pie) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={lift(THEME.shadows.blue)}
              className="rounded-2xl p-4"
              style={{
                background: "#fff",
                border: `1px solid ${THEME.cardBorder}`,
                boxShadow: "0 8px 28px rgba(6,182,212,0.04)",
              }}
            >
              <h6 className="font-semibold text-sm">Segment Distribution</h6>

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
                        color: "#475569",
                        fontSize: 12,
                        paddingTop: 8,
                      }}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* responsive caption for small screens - optional */}
              <div className="mt-2 text-xs text-slate-500">
                Legend placed below chart for clarity on small screens.
              </div>
            </motion.div>
          </aside>
        </main>

        <footer className="mt-8 text-center text-xs text-slate-500">
          Updated UI • screenshot used:{" "}
          <code>/mnt/data/b9b5d9bf-b797-48a6-bf21-b49a23369aa6.png</code>
        </footer>
      </div>
    </div>
  );
}
