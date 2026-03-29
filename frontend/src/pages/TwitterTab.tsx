import { useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { Heatmap } from "../components/Heatmap";
import {
  useTwitterEngagementTrend, useTwitterTopAccounts, useTwitterHashtagTrends, useTwitterHeatmap,
} from "../hooks/useApi";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
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

export function TwitterTab() {
  const [days, setDays] = useState(30);

  const { data: trend = [], isLoading: loadTrend } = useTwitterEngagementTrend(days);
  const { data: accounts = [], isLoading: loadAccounts } = useTwitterTopAccounts(10);
  const { data: hashtags = [] } = useTwitterHashtagTrends(days);
  const { data: heatmapData = [] } = useTwitterHeatmap();

  const totalLikes = trend.reduce((s, d) => s + Number(d.total_likes ?? 0), 0);
  const totalTweets = trend.reduce((s, d) => s + Number(d.tweet_count ?? 0), 0);
  const avgEngagement =
    trend.length > 0
      ? trend.reduce((s, d) => s + Number(d.avg_engagement_rate ?? 0), 0) / trend.length
      : 0;

  const handleExport = useCallback(() => exportCsv(accounts, "top_accounts.csv"), [accounts]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Likes" value={fmt(totalLikes)} sub={`last ${days} days`} accent="purple" />
        <StatCard label="Tweets Tracked" value={fmt(totalTweets)} sub="in period" accent="cyan" />
        <StatCard label="Avg Engagement Rate" value={`${(avgEngagement * 100).toFixed(3)}%`} sub="likes/impressions" accent="amber" />
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Daily Engagement Trend</h3>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  days === d ? "bg-accent-purple text-white" : "bg-surface-raised text-slate-400 hover:text-white"
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
            <LineChart data={trend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Line type="monotone" dataKey="total_likes" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Likes" />
              <Line type="monotone" dataKey="total_retweets" stroke="#06b6d4" strokeWidth={2} dot={false} name="Retweets" />
              <Line type="monotone" dataKey="total_replies" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Replies" />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Trending Hashtags</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hashtags.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="hashtag" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} width={60} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Bar dataKey="total_likes" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Likes" />
            <Bar dataKey="total_retweets" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Retweets" />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Top Accounts by Engagement</h3>
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
                <th className="table-header">Account</th>
                <th className="table-header text-right">Tweets</th>
                <th className="table-header text-right">Likes</th>
                <th className="table-header text-right">Retweets</th>
                <th className="table-header text-right">Impressions</th>
                <th className="table-header text-right">Eng Rate</th>
              </tr>
            </thead>
            <tbody>
              {loadAccounts ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500">Loading...</td></tr>
              ) : (
                accounts.map((a, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="table-cell">
                      <span className="font-medium text-slate-200 font-mono text-xs">@{String(a.account_name)}</span>
                    </td>
                    <td className="table-cell text-right font-mono">{Number(a.tweet_count)}</td>
                    <td className="table-cell text-right font-mono text-accent-purple">{fmt(Number(a.total_likes))}</td>
                    <td className="table-cell text-right font-mono text-accent-cyan">{fmt(Number(a.total_retweets))}</td>
                    <td className="table-cell text-right font-mono text-slate-400">{fmt(Number(a.total_impressions))}</td>
                    <td className="table-cell text-right font-mono text-accent-amber">
                      {Number(a.avg_engagement_pct).toFixed(3)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Heatmap
        data={heatmapData}
        rowKey="hashtag"
        colKey="account_name"
        valueKey="tweet_count"
        title="Hashtag vs Account Activity Heatmap"
        colorScheme="purple"
      />
    </div>
  );
}
