import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useGithubRepos(limit = 20, sort = "stars") {
  return useQuery({
    queryKey: ["github", "repos", limit, sort],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/github/repos?limit=${limit}&sort=${sort}`),
  });
}

export function useGithubTrends(days = 30) {
  return useQuery({
    queryKey: ["github", "trends", days],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/github/trends?days=${days}`),
  });
}

export function useGithubLanguages() {
  return useQuery({
    queryKey: ["github", "languages"],
    queryFn: () => fetchJson<Record<string, unknown>[]>("/api/github/languages"),
  });
}

export function useGithubHeatmap() {
  return useQuery({
    queryKey: ["github", "heatmap"],
    queryFn: () => fetchJson<Record<string, unknown>[]>("/api/github/heatmap"),
  });
}

export function useStripeRevenueTrend(days = 30) {
  return useQuery({
    queryKey: ["stripe", "revenue_trend", days],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/stripe/revenue_trend?days=${days}`),
  });
}

export function useStripeTopCustomers(limit = 10) {
  return useQuery({
    queryKey: ["stripe", "top_customers", limit],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/stripe/top_customers?limit=${limit}`),
  });
}

export function useStripeByCurrency() {
  return useQuery({
    queryKey: ["stripe", "by_currency"],
    queryFn: () => fetchJson<Record<string, unknown>[]>("/api/stripe/by_currency"),
  });
}

export function useStripeHeatmap() {
  return useQuery({
    queryKey: ["stripe", "heatmap"],
    queryFn: () => fetchJson<Record<string, unknown>[]>("/api/stripe/heatmap"),
  });
}

export function useTwitterEngagementTrend(days = 30) {
  return useQuery({
    queryKey: ["twitter", "engagement_trend", days],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/twitter/engagement_trend?days=${days}`),
  });
}

export function useTwitterTopAccounts(limit = 10) {
  return useQuery({
    queryKey: ["twitter", "top_accounts", limit],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/twitter/top_accounts?limit=${limit}`),
  });
}

export function useTwitterHashtagTrends(days = 30) {
  return useQuery({
    queryKey: ["twitter", "hashtag_trends", days],
    queryFn: () => fetchJson<Record<string, unknown>[]>(`/api/twitter/hashtag_trends?days=${days}`),
  });
}

export function useTwitterHeatmap() {
  return useQuery({
    queryKey: ["twitter", "heatmap"],
    queryFn: () => fetchJson<Record<string, unknown>[]>("/api/twitter/heatmap"),
  });
}
