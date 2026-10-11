import { useEffect, useState } from "react";
import type { InsightBundle } from "@/types";

let cache: InsightBundle | null = null;
let inflight: Promise<InsightBundle | null> | null = null;

async function loadInsights(): Promise<InsightBundle | null> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/data/insights/insights.json")
      .then((response) => {
        if (!response.ok) throw new Error(`insights: HTTP ${response.status}`);
        return response.json() as Promise<InsightBundle>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .catch(() => null);
  }
  return inflight;
}

export function useInsights() {
  const [bundle, setBundle] = useState<InsightBundle | null>(cache);

  useEffect(() => {
    let alive = true;
    loadInsights().then((data) => {
      if (alive) setBundle(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return bundle;
}
