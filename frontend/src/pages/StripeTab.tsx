import { useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { Heatmap } from "../components/Heatmap";
import {
  useStripeRevenueTrend, useStripeTopCustomers, useStripeByCurrency, useStripeHeatmap,
} from "../hooks/useApi";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function exportCsv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${r[h] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export function StripeTab() {
  const [days, setDays] = useState(30);

  const { data: trend = [], isLoading: loadTrend } = useStripeRevenueTrend(days);
  const { data: customers = [], isLoading: loadCustomers } = useStripeTopCustomers(10);
  const { data: currencies = [] } = useStripeByCurrency();
  const { data: heatmapData = [] } = useStripeHeatmap();

  const totalRevenue = trend.reduce((s, d) => s + Number(d.daily_revenue ?? 0), 0);
  const totalTransactions = trend.reduce((s, d) => s + Number(d.transaction_count ?? 0), 0);
  const avgOrderValue =
    trend.length > 0
      ? trend.reduce((s, d) => s + Number(d.avg_order_value ?? 0), 0) / trend.length
      : 0;

  const handleExport = useCallback(() => exportCsv(customers, "top_customers.csv"), [customers]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Period Revenue" value={fmt(totalRevenue)} sub={`last ${days} days`} accent="green" />
        <StatCard label="Transactions" value={fmtNum(totalTransactions)} sub="all statuses" accent="blue" />
        <StatCard label="Avg Order Value" value={fmt(avgOrderValue)} sub="successful only" accent="amber" />
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Daily Revenue Trend</h3>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  days === d ? "bg-accent-green text-white" : "bg-surface-raised text-slate-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {loadTrend ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(v: unknown) => [fmt(Number(v)), "Revenue"]}
              />
              <Area type="monotone" dataKey="daily_revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Revenue by Currency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={currencies}
                dataKey="total_revenue"
                nameKey="currency_code"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {currencies.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [fmt(Number(v)), "Revenue"]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Transaction Count by Currency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={currencies} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="currency_code" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Bar dataKey="transaction_count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Top Customers by Revenue</h3>
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded text-xs font-medium bg-surface-raised text-slate-400 hover:text-white transition-colors border border-surface-border"
          >
            CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="table-header">#</th>
                <th className="table-header">Customer ID</th>
                <th className="table-header">Since</th>
                <th className="table-header text-right">Transactions</th>
                <th className="table-header text-right">Total Spent</th>
                <th className="table-header text-right">Avg Value</th>
                <th className="table-header">Last Txn</th>
              </tr>
            </thead>
            <tbody>
              {loadCustomers ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500">Loading...</td></tr>
              ) : (
                customers.map((c, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="table-cell font-mono text-xs text-slate-300">{String(c.customer_id).slice(-12)}</td>
                    <td className="table-cell text-slate-400 text-xs">{String(c.customer_since)}</td>
                    <td className="table-cell text-right font-mono">{Number(c.num_transactions)}</td>
                    <td className="table-cell text-right font-mono text-accent-green font-semibold">{fmt(Number(c.total_spent))}</td>
                    <td className="table-cell text-right font-mono text-slate-400">{fmt(Number(c.avg_transaction_value))}</td>
                    <td className="table-cell text-xs text-slate-400">{String(c.last_transaction)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Heatmap
        data={heatmapData}
        rowKey="currency_code"
        colKey="amount_bucket"
        valueKey="transaction_count"
        title="Transaction Distribution: Currency vs Amount Bucket"
        colorScheme="green"
      />
    </div>
  );
}
