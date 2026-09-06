export const CACHE_TAGS = {
  ops: "wasty:ops",
  analyticsRoot: "wasty:analytics",
  analytics: (range: string) => `wasty:analytics:${range}`,
  impact: "wasty:impact",
  partners: "wasty:partners",
  jobs: "wasty:jobs",
  govDesk: "wasty:gov:desk",
} as const;

export function bustAnalyticsCache(revalidateTag: (tag: string, profile: "max") => void) {
  revalidateTag(CACHE_TAGS.analyticsRoot, "max");
  for (const range of ["7d", "30d", "90d"] as const) {
    revalidateTag(CACHE_TAGS.analytics(range), "max");
  }
}

export const CACHE_TTL = {
  ops: 30,
  analytics: 60,
  impact: 60,
  govDesk: 30,
} as const;
