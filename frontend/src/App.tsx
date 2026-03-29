import { useState } from "react";
import clsx from "clsx";
import { GithubTab } from "./pages/GithubTab";
import { StripeTab } from "./pages/StripeTab";
import { TwitterTab } from "./pages/TwitterTab";

type Tab = "github" | "stripe" | "twitter";

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "github", label: "GitHub", desc: "Repository analytics from GitHub REST API" },
  { id: "stripe", label: "Stripe", desc: "Payment transactions (mock data)" },
  { id: "twitter", label: "Twitter", desc: "Tweet engagement (mock data)" },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-surface-raised text-slate-500 border border-surface-border font-mono">
      {children}
    </span>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("github");

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="border-b border-surface-border bg-surface-panel/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Data Warehouse
                <Badge>v1.0</Badge>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Multi-Source Analytics Platform</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="text-xs text-slate-400">Live</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-1 border-b border-surface-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-5 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "text-white border-accent-blue bg-surface-panel"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-surface-panel/40"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <p className="text-xs text-slate-500">{active.desc}</p>
        </div>

        {activeTab === "github" && <GithubTab />}
        {activeTab === "stripe" && <StripeTab />}
        {activeTab === "twitter" && <TwitterTab />}
      </div>
    </div>
  );
}
