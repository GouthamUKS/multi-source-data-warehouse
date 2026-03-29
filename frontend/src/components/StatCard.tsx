import { type ReactNode } from "react";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "purple" | "green" | "amber" | "red" | "cyan";
  icon?: ReactNode;
}

const accentMap: Record<string, string> = {
  blue: "border-accent-blue/40 bg-accent-blue/5",
  purple: "border-accent-purple/40 bg-accent-purple/5",
  green: "border-accent-green/40 bg-accent-green/5",
  amber: "border-accent-amber/40 bg-accent-amber/5",
  red: "border-accent-red/40 bg-accent-red/5",
  cyan: "border-accent-cyan/40 bg-accent-cyan/5",
};

const textAccentMap: Record<string, string> = {
  blue: "text-accent-blue",
  purple: "text-accent-purple",
  green: "text-accent-green",
  amber: "text-accent-amber",
  red: "text-accent-red",
  cyan: "text-accent-cyan",
};

export function StatCard({ label, value, sub, accent = "blue", icon }: StatCardProps) {
  return (
    <div className={clsx("panel p-5 border", accentMap[accent])}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="stat-label">{label}</span>
          <span className={clsx("stat-value", textAccentMap[accent])}>{value}</span>
          {sub && <span className="text-xs text-slate-500 mt-1">{sub}</span>}
        </div>
        {icon && (
          <div className={clsx("p-2 rounded-lg opacity-80", accentMap[accent])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
