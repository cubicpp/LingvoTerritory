/**
 * PhonoMapView.tsx — 声韵调地理分布 (小学堂数据)
 * 输入汉字 → 选择声母/韵母/调类 → 地图以色阶展示各地读音
 */
import { useState, useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";

interface XxEntry { char: string; initial: string; final: string; tone_value: string; tone_category: string; note: string }
interface MapPoint { name: string; lng: number; lat: number; group: string; entry: XxEntry }

const PT_CACHE: Record<string, MapPoint> = {};

function loadPointCoords(ptName: string): MapPoint | null {
  if (PT_CACHE[ptName]) return PT_CACHE[ptName];
  const pts = useAppStore.getState().dataCache.dialects?.points;
  if (!pts) return null;
  const m = pts.find(p => p.id === ptName || p.name === ptName || p.location?.includes(ptName));
  if (m && m.lat && m.lng) {
    PT_CACHE[ptName] = { name: ptName, lng: m.lng, lat: m.lat, group: m.group || "", entry: null as any };
    return PT_CACHE[ptName];
  }
  return null;
}

type FeatureMode = "initial" | "final" | "tone";

const xxBundleCache: Record<string, Record<string, Record<string, XxEntry[]>>> = {};

export function PhonoMapView() {
  const lang = useAppStore((s) => s.lang);
  const china = useAppStore((s) => s.dataCache.china);
  const theme = useAppStore((s) => s.theme);
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [query, setQuery] = useState("東");
  const [mode, setMode] = useState<FeatureMode>("initial");
  const [composing, setComposing] = useState(false);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompositionStart = () => setComposing(true);
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setComposing(false); setQuery((e.data || e.currentTarget.value).slice(0, 1));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(composing ? e.target.value : e.target.value.slice(0, 1));
  };

  // Load xx_bundles for queried character
  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const code = query.codePointAt(0)?.toString(16).toUpperCase();
    if (!code) { setLoading(false); return; }
    const cp = parseInt(code, 16);
    const bundleStart = Math.floor(cp / 256) * 256;
    const bundleKey = bundleStart.toString(16).toUpperCase().padStart(5, "0");
    const bundleUrl = `/data/xx_bundles/${bundleKey}.json`;

    if (xxBundleCache[bundleKey]) {
      buildPoints(code, xxBundleCache[bundleKey][code] || {});
      setLoading(false);
    } else {
      fetch(bundleUrl)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(bundle => {
          xxBundleCache[bundleKey] = bundle;
          buildPoints(code, bundle[code] || {});
        })
        .catch(() => setMapPoints([]))
        .finally(() => setLoading(false));
    }
  }, [query]);

  function buildPoints(code: string, data: Record<string, XxEntry[]>) {
    const pts = useAppStore.getState().dataCache.dialects?.points;
    if (!pts) { setMapPoints([]); return; }
    const ptLookup = new Map<string, { lng: number; lat: number; group: string }>();
    for (const p of pts) {
      if (p.lat && p.lng) {
        ptLookup.set(p.id, { lng: p.lng, lat: p.lat, group: p.group || "" });
        if (p.name !== p.id) ptLookup.set(p.name, { lng: p.lng, lat: p.lat, group: p.group || "" });
      }
    }
    const result: MapPoint[] = [];
    for (const [ptName, entries] of Object.entries(data)) {
      const e = entries[0];
      if (!e) continue;
      const base = ptName.split("(")[0];
      let coord = ptLookup.get(ptName) || ptLookup.get(base);
      if (!coord) {
        // Try fuzzy: find any point whose name/id contains this name
        for (const [k, v] of ptLookup) {
          if (k.includes(base) || base.includes(k.slice(0, 2))) {
            coord = v; break;
          }
        }
      }
      if (coord) {
        result.push({ name: ptName, lng: coord.lng, lat: coord.lat, group: coord.group, entry: e });
      }
    }
    setMapPoints(result);
  }

  // Feature values for legend
  const featureValues = useMemo(() => {
    const vals = new Set<string>();
    for (const p of mapPoints) {
      const v = mode === "initial" ? p.entry.initial : mode === "final" ? p.entry.final : p.entry.tone_category;
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }, [mapPoints, mode]);

  const featureColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    const colors = ["#E74C3C","#3498DB","#2ECC71","#F39C12","#9B59B6","#1ABC9C","#E67E22","#2980B9","#27AE60","#C0392B","#8E44AD","#16A085"];
    featureValues.forEach((v, i) => { m[v] = colors[i % colors.length]; });
    return m;
  }, [featureValues]);

  // Render map
  useEffect(() => {
    if (!china || !chartRef.current) return;
    if (chart.current) { safeDispose(chart.current); chart.current = null; }

    echarts.registerMap("china", china as any);
    const c = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    chart.current = c;

    const seriesData = mapPoints.map(p => ({
      name: p.name,
      value: [p.lng, p.lat, 1],
      itemStyle: {
        color: mode === "initial" ? (featureColorMap[p.entry.initial] || "#999")
             : mode === "final"   ? (featureColorMap[p.entry.final] || "#999")
             : (featureColorMap[p.entry.tone_category] || "#999"),
      },
      entry: p.entry,
    }));

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const e = p.data?.entry;
          if (!e) return p.name;
          return `<b>${p.name}</b><br/>声: ${e.initial || "-"}　韵: ${e.final || "-"}<br/>调: ${e.tone_value || "-"} (${e.tone_category || "-"})`;
        },
      },
      geo: {
        map: "china",
        roam: true,
        zoom: 1.2,
        center: [108, 34],
        itemStyle: { areaColor: "#f0ece0", borderColor: "#d6d3d1" },
        emphasis: { itemStyle: { areaColor: "#e8e0cc" } },
      },
      series: [{
        type: "scatter",
        coordinateSystem: "geo",
        data: seriesData,
        symbolSize: (val: number[]) => Math.max(6, Math.min(16, mapPoints.length > 200 ? 6 : 10)),
        encode: { value: 2 },
        label: { show: false },
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(c); chart.current = null; };
  }, [mapPoints, mode, featureColorMap, china]);

  const modes: { key: FeatureMode; zh: string; tw: string }[] = [
    { key: "initial", zh: "声母", tw: "聲母" },
    { key: "final", zh: "韵母", tw: "韻母" },
    { key: "tone", zh: "调类", tw: "調類" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0, flexWrap: "wrap" }}>
        <input value={query} onChange={handleChange} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd} onBlur={() => { if (composing) { setComposing(false); setQuery(q => q.slice(0, 1)); } }}
          style={{ width: 48, padding: "4px 8px", fontSize: 18, textAlign: "center", fontFamily: "var(--font-serif)", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-overlay)", color: "var(--text)", outline: "none" }} />
        <span style={{ fontSize: 32, fontFamily: "var(--font-serif)", color: "var(--accent)", lineHeight: 1 }}>{query}</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
          {modes.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: "1px solid var(--border)", cursor: "pointer",
                background: mode === m.key ? "var(--accent-subtle)" : "transparent",
                color: mode === m.key ? "var(--accent)" : "var(--text-tertiary)",
                fontWeight: mode === m.key ? 600 : 400 }}>
              {lang === "zh-CN" ? m.zh : m.tw}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
          {mapPoints.length} {lang === "zh-CN" ? "方言点" : "方言點"}
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", padding: "6px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0, maxHeight: 60, overflow: "auto" }}>
        {featureValues.map(v => (
          <span key={v} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: featureColorMap[v], flexShrink: 0 }} />
            {v}
          </span>
        ))}
      </div>

      {/* Map or empty state */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          {lang === "zh-CN" ? "加载中..." : "載入中..."}
        </div>
      ) : mapPoints.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          {lang === "zh-CN" ? "该字暂无方言声韵调数据" : "該字暫無方言聲韻調數據"}
        </div>
      ) : (
        <div ref={chartRef} style={{ flex: 1, width: "100%" }} />
      )}
    </div>
  );
}
