import { useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { Heatmap } from "../components/Heatmap";
import {
  useGithubRepos, useGithubTrends, useGithubLanguages, useGithubHeatmap,
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

const SORT_OPTIONS = [
  { label: "Stars", value: "stars" },
  { label: "Forks", value: "forks" },
  { label: "Issues", value: "open_issues" },
];

export function GithubTab() {
  const [sort, setSort] = useState("stars");
  const [days, setDays] = useState(30);

  const { data: repos = [], isLoading: loadRepos } = useGithubRepos(20, sort);
  const { data: trends = [], isLoading: loadTrends } = useGithubTrends(days);
  const { data: languages = [] } = useGithubLanguages();
  const { data: heatmapData = [] } = useGithubHeatmap();

  const totalStars = repos.reduce((s, r) => s + Number(r.stars ?? 0), 0);
  const totalRepos = repos.length;
  const topLang = (languages[0] as Record<string, unknown> | undefined)?.language_name as string | undefined;

  const handleExport = useCallback(() => exportCsv(repos, "github_repos.csv"), [repos]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Stars" value={fmt(totalStars)} sub="across top repos" accent="blue" />
        <StatCard label="Repos Tracked" value={totalRepos} sub="from 5 languages" accent="cyan" />
        <StatCard label="Top Language" value={topLang ?? "-"} sub="by total stars" accent="purple" />
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Star Count Over Snapshots</h3>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  days === d
                    ? "bg-accent-blue text-white"
                    : "bg-surface-raised text-slate-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {loadTrends ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#60a5fa" }}
              />
              <Line type="monotone" dataKey="total_stars" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total Stars" />
              <Line type="monotone" dataKey="repo_count" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Repos" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Stars by Language</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={languages} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="language_name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Bar dataKey="total_stars" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Stars" />
            <Bar dataKey="avg_stars" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Avg Stars" />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Top Repositories</h3>
          <div className="flex items-center gap-2">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setSort(o.value)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  sort === o.value
                    ? "bg-accent-blue text-white"
                    : "bg-surface-raised text-slate-400 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={handleExport}
              className="px-3 py-1 rounded text-xs font-medium bg-surface-raised text-slate-400 hover:text-white transition-colors border border-surface-border"
            >
              CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="table-header">Repository</th>
                <th className="table-header">Language</th>
                <th className="table-header text-right">Stars</th>
                <th className="table-header text-right">Forks</th>
                <th className="table-header text-right">Issues</th>
              </tr>
            </thead>
            <tbody>
              {loadRepos ? (
                <tr><td colSpan={5} className="table-cell text-center text-slate-500">Loading...</td></tr>
              ) : (
                repos.map((r, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell">
                      <div className="font-medium text-slate-200 font-mono text-xs">{String(r.repo_name)}</div>
                      <div className="text-slate-500 text-xs">{String(r.owner)}</div>
                    </td>
                    <td className="table-cell">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                        {String(r.language_name)}
                      </span>
                    </td>
                    <td className="table-cell text-right font-mono text-accent-amber">{fmt(Number(r.stars))}</td>
                    <td className="table-cell text-right font-mono text-slate-400">{fmt(Number(r.forks))}</td>
                    <td className="table-cell text-right font-mono text-slate-400">{Number(r.open_issues)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Heatmap
        data={heatmapData}
        rowKey="language_name"
        colKey="star_bucket"
        valueKey="repo_count"
        title="Repo Distribution: Language vs Star Range"
        colorScheme="blue"
      />
    </div>
  );
}
