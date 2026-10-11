import { useRef, useEffect, useState, useMemo } from "react";
import * as echarts from "echarts";
import * as d3 from "d3";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { LegendList, RailSection, ResearchLayout, SegmentedControl } from "@/components/ui/ResearchLayout";

interface ToneFeatures {
  name: string;
  broad: string;
  toneCount: number;
  avgPitch: number;
  pitchRange: number;
}

interface RidgeGroup {
  broad: string;
  tones: number[];
  color: string;
}

function parseToneFeatures(point: any): ToneFeatures | null {
  if (!point.toneSystem) return null;
  const ts = typeof point.toneSystem === "string" ? JSON.parse(point.toneSystem) : point.toneSystem;
  const keys = Object.keys(ts);
  const count = keys.length;
  if (count === 0 || count > 15) return null;
  const pitches: number[] = [];
  for (const k of keys) {
    const val = Array.isArray(ts[k]) ? ts[k][0] : ts[k];
    if (typeof val === "string") {
      for (const ch of val) {
        const d = parseInt(ch, 10);
        if (d >= 1 && d <= 5) { pitches.push(d); break; }
      }
    }
  }
  if (pitches.length === 0) return null;
  const avgPitch = pitches.reduce((s, v) => s + v, 0) / pitches.length;
  const pitchRange = Math.max(...pitches) - Math.min(...pitches);
  return {
    name: point.title || point.name,
    broad: point.broad || "未分类",
    toneCount: count,
    avgPitch: Math.round(avgPitch * 10) / 10,
    pitchRange,
  };
}

function gaussianKDE(values: number[], bandwidth: number, range: [number, number], steps: number) {
  const points: [number, number][] = [];
  const n = values.length;
  if (n === 0) return points;
  const step = (range[1] - range[0]) / steps;
  for (let x = range[0]; x <= range[1]; x += step) {
    let density = 0;
    for (const v of values) {
      const z = (x - v) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= n * bandwidth * Math.sqrt(2 * Math.PI);
    points.push([x, density]);
  }
  return points;
}

export function ParallelView() {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const tabView = useAppStore((s) => s.tabView);
  const dataCache = useAppStore((s) => s.dataCache);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const ridgeContainerRef = useRef<HTMLDivElement>(null);
  const dk = theme === "dark";
  const [parallelMode, setParallelMode] = useState<"agg" | "all">("agg");
  const [filterBroad, setFilterBroad] = useState("");

  const allFeatures = useMemo(() => {
    const points = dataCache?.dialects?.points ?? [];
    const result: ToneFeatures[] = [];
    for (const p of points) {
      const f = parseToneFeatures(p);
      if (f && f.toneCount >= 2) result.push(f);
    }
    return result;
  }, [dataCache?.dialects]);

  const broadGroups = useMemo(() => {
    const map = new Map<string, ToneFeatures[]>();
    for (const f of allFeatures) {
      if (f.broad === "未分类") continue;
      if (!map.has(f.broad)) map.set(f.broad, []);
      map.get(f.broad)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [allFeatures]);

  // Parallel chart
  useEffect(() => {
    if (tabView !== "parallel" || !allFeatures.length || !containerRef.current) return;

    const axisLabels = [
      lang === "zh-CN" ? "声调数" : "聲調數",
      lang === "zh-CN" ? "平均调高" : "平均調高",
      lang === "zh-CN" ? "调域跨度" : "調域跨度",
    ];

    const med = (arr: number[]) => { const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

    let parallelData: any[];
    if (parallelMode === "agg") {
      parallelData = broadGroups.map(([broad, features]) => ({
        name: `${broad} (${features.length})`,
        value: [
          med(features.map(f => f.toneCount)),
          Math.round(med(features.map(f => f.avgPitch)) * 10) / 10,
          med(features.map(f => f.pitchRange)),
        ],
        lineStyle: { color: BROAD_COLORS[broad] || "#a0a0a0", width: 4, opacity: 0.85 },
      }));
    } else {
      const filtered = filterBroad ? allFeatures.filter(f => f.broad === filterBroad) : allFeatures;
      parallelData = filtered.map((f) => ({
        name: f.name,
        value: [f.toneCount, f.avgPitch, f.pitchRange],
        lineStyle: { color: BROAD_COLORS[f.broad] || "#a0a0a0", width: 1.2, opacity: filterBroad ? 0.6 : 0.25 },
      }));
    }

    if (chartRef.current) { safeDispose(chartRef.current); chartRef.current = null; }
    const chart = echarts.init(containerRef.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: any) =>
          `<b>${p.name || ""}</b><br/>${axisLabels[0]}: ${p.value?.[0]}<br/>${axisLabels[1]}: ${p.value?.[1]}<br/>${axisLabels[2]}: ${p.value?.[2]}`,
      },
      parallelAxis: axisLabels.map((name, idx) => ({
        dim: idx, name,
        nameTextStyle: { color: dk ? "#a39d96" : "#5c5650", fontSize: 12 },
        axisLabel: { color: dk ? "#78736d" : "#8c857a", fontSize: 10 },
      })),
      parallel: {
        left: 60, right: 60, top: 40, bottom: 40,
        parallelAxisDefault: {
          axisLine: { lineStyle: { color: dk ? "#282d38" : "#d6d3d1" } },
          splitLine: { show: false },
        },
      },
      series: [{
        type: "parallel",
        lineStyle: { width: 1.2, opacity: 0.45 },
        emphasis: { lineStyle: { width: 4, opacity: 1 } },
        data: parallelData,
        smooth: true,
      }],
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); safeDispose(chart); chartRef.current = null; };
  }, [allFeatures, broadGroups, dk, tabView, lang, parallelMode, filterBroad]);

  // Ridge data
  const ridgeGroups = useMemo(() => {
    const groupMap = new Map<string, number[]>();
    for (const f of allFeatures) {
      if (!groupMap.has(f.broad)) groupMap.set(f.broad, []);
      groupMap.get(f.broad)!.push(f.toneCount);
    }
    const result: RidgeGroup[] = [];
    for (const [broad, tones] of groupMap) {
      if (tones.length < 3) continue;
      result.push({ broad, tones, color: BROAD_COLORS[broad] || "#a0a0a0" });
    }
    result.sort((a, b) => (d3.median(a.tones) || 0) - (d3.median(b.tones) || 0));
    return result;
  }, [allFeatures]);

  const [ridgeWidth, setRidgeWidth] = useState(0);

  useEffect(() => {
    if (tabView !== "ridge" || !ridgeGroups.length || !ridgeContainerRef.current) return;
    let cancelled = false;
    const render = () => { if (!cancelled && ridgeContainerRef.current) setRidgeWidth(ridgeContainerRef.current.clientWidth); };
    const raf = requestAnimationFrame(render);
    const onResize = () => requestAnimationFrame(render);
    window.addEventListener("resize", onResize);
    return () => { cancelled = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [tabView, ridgeGroups.length]);

  useEffect(() => {
    if (tabView !== "ridge" || !ridgeGroups.length || !ridgeContainerRef.current || !ridgeWidth) return;
    const container = d3.select(ridgeContainerRef.current);
    container.selectAll("*").remove();

    const w = ridgeWidth;
    const narrow = w < 600;
    const margin = narrow ? { top: 12, right: 80, bottom: 32, left: 80 } : { top: 16, right: 150, bottom: 36, left: 150 };
    const iw = w - margin.left - margin.right;
    if (iw <= 0) return;
    const rowH = narrow ? 48 : 56;
    const height = margin.top + ridgeGroups.length * rowH + margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${w} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%").style("height", "100%").style("display", "block").style("min-height", "400px");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top + 6})`);

    const allTones = ridgeGroups.flatMap((grp) => grp.tones);
    const xMin = Math.max(0, (d3.min(allTones) || 1) - 1);
    const xMax = (d3.max(allTones) || 6) + 1;
    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, iw]);

    g.append("g")
      .attr("transform", `translate(0,${ridgeGroups.length * rowH})`)
      .call(d3.axisBottom(x).ticks(Math.min(8, xMax - xMin + 1)).tickFormat(d3.format("d")))
      .selectAll("text").attr("fill", dk ? "#78736d" : "#8c857a").attr("font-size", 10);

    ridgeGroups.forEach((grp, i) => {
      const y0 = i * rowH;
      const bw = 0.8;
      const kde = gaussianKDE(grp.tones, bw, [xMin, xMax], 120);
      if (!kde.length) return;

      const maxDens = d3.max(kde, (d) => d[1]) || 0.01;
      const y = d3.scaleLinear().domain([0, maxDens * 1.15]).range([rowH - 10, 0]);

      const area = d3.area<[number, number]>()
        .x((d) => x(d[0])).y0(rowH - 10).y1((d) => y(d[1])).curve(d3.curveBasis);

      g.append("path").datum(kde).attr("d", area)
        .attr("fill", grp.color).attr("fill-opacity", 0.4)
        .attr("stroke", grp.color).attr("stroke-width", 1.2).attr("stroke-opacity", 0.8)
        .attr("transform", `translate(0,${y0})`);

      g.append("text").attr("x", -6).attr("y", y0 + rowH / 2 + 2)
        .attr("text-anchor", "end").attr("font-size", 11).attr("font-weight", 600)
        .attr("fill", grp.color).text(`${grp.broad} (${grp.tones.length})`);
    });
  }, [ridgeGroups, dk, tabView, ridgeWidth]);

  const loading = !dataCache?.dialects?.points?.length;
  if (loading) {
    return (<div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载音系特征..." : "載入音系特徵..."}</span></div>);
  }

  const rail = (
    <>
      {tabView === "parallel" && (
        <RailSection title={lang === "zh-CN" ? "显示模式" : "顯示模式"}>
          <SegmentedControl
            value={parallelMode}
            onChange={(v) => { setParallelMode(v as "agg" | "all"); if (v === "agg") setFilterBroad(""); }}
            options={[
              { value: "agg", label: lang === "zh-CN" ? "大类聚合" : "大類聚合" },
              { value: "all", label: lang === "zh-CN" ? "全部方言" : "全部方言" },
            ]}
          />
        </RailSection>
      )}
      <RailSection title={lang === "zh-CN" ? "方言大类" : "方言大類"}>
        <LegendList
          items={broadGroups.map(([broad, features]) => ({
            key: broad,
            label: broad,
            value: features.length,
            color: BROAD_COLORS[broad] || "#999",
            active: !filterBroad || filterBroad === broad,
            onClick: parallelMode === "all" || tabView === "ridge" ? () => setFilterBroad(filterBroad === broad ? "" : broad) : undefined,
          }))}
        />
      </RailSection>
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Phonology" railTitle={lang === "zh-CN" ? "音系特征" : "音系特徵"}>
      {tabView === "parallel" ? (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      ) : (
        <div ref={ridgeContainerRef} style={{ width: "100%", height: "100%", overflow: "auto", minHeight: 400 }}>
          {ridgeGroups.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60 }}>{lang === "zh-CN" ? "暂无声调数据" : "暫無聲調數據"}</div>
          )}
        </div>
      )}
    </ResearchLayout>
  );
}
