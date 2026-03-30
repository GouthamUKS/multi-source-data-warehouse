import { useMemo } from "react";

interface HeatmapProps {
  data: Record<string, unknown>[];
  rowKey: string;
  colKey: string;
  valueKey: string;
  title: string;
  colorScheme?: "blue" | "green" | "purple";
}

const COLOR_SCHEMES = {
  blue: ["#1e3a5f", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
  green: ["#064e3b", "#065f46", "#047857", "#059669", "#10b981", "#34d399"],
  purple: ["#3b0764", "#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa"],
};

function getColor(normalized: number, scheme: keyof typeof COLOR_SCHEMES): string {
  const colors = COLOR_SCHEMES[scheme];
  const idx = Math.min(Math.floor(normalized * (colors.length - 1)), colors.length - 1);
  return colors[idx];
}

export function Heatmap({ data, rowKey, colKey, valueKey, title, colorScheme = "blue" }: HeatmapProps) {
  const { rows, cols, matrix, maxVal } = useMemo(() => {
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const lookup: Record<string, Record<string, number>> = {};

    for (const d of data) {
      const r = String(d[rowKey] ?? "");
      const c = String(d[colKey] ?? "");
      const v = Number(d[valueKey] ?? 0);
      rowSet.add(r);
      colSet.add(c);
      if (!lookup[r]) lookup[r] = {};
      lookup[r][c] = (lookup[r][c] ?? 0) + v;
    }

    const rows = Array.from(rowSet).sort();
    const cols = Array.from(colSet).sort();
    let maxVal = 0;
    for (const r of rows) for (const c of cols) {
      const v = lookup[r]?.[c] ?? 0;
      if (v > maxVal) maxVal = v;
    }

    return { rows, cols, matrix: lookup, maxVal };
  }, [data, rowKey, colKey, valueKey]);

  if (rows.length === 0) {
    return (
      <div className="panel p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
        <p className="text-slate-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="panel p-5 overflow-auto">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="text-xs text-slate-500 font-normal text-left pr-3 pb-1 min-w-[80px]"></th>
              {cols.map((c) => (
                <th key={c} className="text-xs text-slate-400 font-medium pb-1 px-1 min-w-[56px] text-center">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <td className="text-xs text-slate-400 font-medium pr-3 py-0.5 whitespace-nowrap">{r}</td>
                {cols.map((c) => {
                  const v = matrix[r]?.[c] ?? 0;
                  const normalized = maxVal > 0 ? v / maxVal : 0;
                  const bg = v > 0 ? getColor(normalized, colorScheme) : "#1e293b";
                  return (
                    <td
                      key={c}
                      title={`${r} / ${c}: ${v.toLocaleString()}`}
                      className="rounded"
                      style={{
                        background: bg,
                        width: 56,
                        height: 28,
                        textAlign: "center",
                        fontSize: "10px",
                        color: normalized > 0.5 ? "#fff" : "#94a3b8",
                        fontVariantNumeric: "tabular-nums",
                        cursor: "default",
                      }}
                    >
                      {v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-slate-500">Low</span>
        <div
          className="h-2 w-24 rounded"
          style={{
            background: `linear-gradient(to right, ${COLOR_SCHEMES[colorScheme][0]}, ${COLOR_SCHEMES[colorScheme][COLOR_SCHEMES[colorScheme].length - 1]})`,
          }}
        />
        <span className="text-xs text-slate-500">High</span>
      </div>
    </div>
  );
}
