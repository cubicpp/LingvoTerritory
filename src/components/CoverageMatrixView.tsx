/**
 * CoverageMatrixView.tsx — 音韵覆盖率矩阵
 * Heatmap: dialect points × 摄 (she) — showing phonological survey coverage
 */
import { useEffect, useRef, useState, useMemo } from "react";
import * as echarts from "echarts";
import { useAppStore } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";

interface SurveyEntry {
  c: string;
  i: string;   // 声类
  s: string;   // 摄
  d: string;   // 等
  r: string;   // 韵
  tc: string;  // 调类
}

interface DialectReading {
  pointId: string;
  reading: string;
  pointName: string;
}

export function CoverageMatrixView() {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const points = useAppStore((s) => s.dataCache.dialects?.points);
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const dk = theme === "dark";

  const [survey, setSurvey] = useState<SurveyEntry[]>([]);
  const [drData, setDrData] = useState<{ charIndex: Record<string, DialectReading[]> } | null>(null);
  const [groupBy, setGroupBy] = useState<"s" | "i">("s");
  const [page, setPage] = useState<"page1" | "page2">("page1");

  useEffect(() => {
    fetch("/data/survey_table.json").then(r => r.json()).then(setSurvey).catch(() => {});
    fetch("/data/dialect_readings.json").then(r => r.json()).then(setDrData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chart.current = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(chart.current); chart.current = null; };
  }, []);

  const matrix = useMemo(() => {
    if (!survey.length || !drData || !points) return null;

    // Build: char → group (摄 or 声类)
    const charGroup: Record<string, string> = {};
    for (const e of survey) {
      const g = groupBy === "s" ? e.s : e.i;
      if (g) charGroup[e.c] = g;
    }

    // For each dialect point with readings, count coverage per group
    const pointCoverage: Record<string, Record<string, number>> = {};
    const pointNames: Record<string, string> = {};
    for (const readings of Object.values(drData.charIndex || {})) {
      for (const r of readings) {
        const g = charGroup[r.pointName] || charGroup[r.pointId]; // char → group lookup is per-character, not per-point
        // Actually, the charGroup is indexed by character, not point.
        // We need: for each (point, char), if that char has a reading at that point, increment the char's group.
      }
    }

    // Correct approach: iterate characters in survey, check which points have readings
    const pc: Record<string, Record<string, number>> = {}; // pointId → { group → count }
    for (const e of survey) {
      const g = groupBy === "s" ? e.s : e.i;
      if (!g) continue;
      const readings = drData.charIndex[e.c];
      if (!readings) continue;
      for (const r of readings) {
        if (!pc[r.pointId]) pc[r.pointId] = {};
        pc[r.pointId][g] = (pc[r.pointId][g] || 0) + 1;
        pointNames[r.pointId] = r.pointName;
      }
    }

    // Get all group names sorted
    const allGroups = [...new Set(survey.map(e => groupBy === "s" ? e.s : e.i).filter(Boolean))].sort();

    // Select points by total coverage, slice by page
    const sorted = Object.entries(pc)
      .map(([id, groups]) => ({ id, total: Object.values(groups).reduce((a, b) => a + b, 0), name: pointNames[id] || id }))
      .sort((a, b) => b.total - a.total);
    const pageSize = 50;
    const pointIds = page === "page1" ? sorted.slice(0, pageSize) : sorted.slice(pageSize);

    // Build matrix
    const rows = pointIds.map(p => p.name.length > 8 ? p.name.slice(0, 7) + "…" : p.name);
    const cols = allGroups;
    const data: [number, number, number][] = [];
    let maxVal = 0;
    pointIds.forEach((p, ri) => {
      allGroups.forEach((g, ci) => {
        const v = pc[p.id]?.[g] || 0;
        if (v > 0) data.push([ci, ri, v]);
        if (v > maxVal) maxVal = v;
      });
    });

    return { rows, cols, data, maxVal, pointIds, totalPoints: Object.keys(pc).length };
  }, [survey, drData, points, groupBy, page]);

  useEffect(() => {
    if (!chart.current || !matrix) return;
    const c = chart.current;

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: dk ? "#181d28" : "#fff",
        borderColor: dk ? "#282d38" : "#e5e0d5",
        textStyle: { color: dk ? "#e8e4df" : "#1a1814", fontSize: 12 },
        formatter: (p: any) => {
          const col = matrix.cols[p.data?.[0] ?? 0];
          const row = matrix.rows[p.data?.[1] ?? 0];
          return `${row}<br/>${groupBy === "s" ? "摄" : "声类"}: ${col}<br/>收录: ${p.data?.[2] ?? 0} 字`;
        },
      },
      grid: { left: 120, right: 60, top: 20, bottom: 60 },
      xAxis: {
        type: "category", data: matrix.cols, position: "bottom",
        axisLabel: { rotate: 45, fontSize: 11, color: dk ? "#a0abb8" : "#5a5a5a" },
        splitArea: { show: true, areaStyle: { color: [dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", "transparent"] } },
      },
      yAxis: {
        type: "category", data: matrix.rows,
        axisLabel: { fontSize: 10, color: dk ? "#a0abb8" : "#5a5a5a" },
        splitArea: { show: true, areaStyle: { color: [dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", "transparent"] } },
      },
      visualMap: {
        min: 0, max: matrix.maxVal,
        calculable: true, orient: "vertical", right: 10, top: 20,
        inRange: { color: dk ? ["#151b26", "#4a7c59", "#e8b44a", "#c43a31"] : ["#f2f0eb", "#a8d5a2", "#f5c842", "#e0553d"] },
        textStyle: { color: dk ? "#a0abb8" : "#5a5a5a" },
      },
      series: [{
        type: "heatmap", data: matrix.data,
        label: { show: matrix.data.length < 500, fontSize: 9, color: dk ? "#e8e4df" : "#1a1814" },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
      }],
    };

    c.setOption(option, true);
  }, [matrix, dk, groupBy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "分组:" : "分組:"}</span>
        {(["s", "i"] as const).map(k => (
          <button key={k} onClick={() => setGroupBy(k)}
            style={{
              padding: "4px 12px", borderRadius: 6, border: groupBy === k ? "1px solid var(--accent)" : "0.5px solid var(--border)",
              background: groupBy === k ? "var(--accent-subtle)" : "transparent",
              color: groupBy === k ? "var(--accent)" : "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}>
            {k === "s" ? (lang === "zh-CN" ? "按摄" : "按攝") : (lang === "zh-CN" ? "按声类" : "按聲類")}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 12 }}>{lang === "zh-CN" ? "页面:" : "頁面:"}</span>
        {(["page1", "page2"] as const).map(p => (
          <button key={p} onClick={() => setPage(p)}
            style={{
              padding: "4px 12px", borderRadius: 6, border: page === p ? "1px solid var(--accent)" : "0.5px solid var(--border)",
              background: page === p ? "var(--accent-subtle)" : "transparent",
              color: page === p ? "var(--accent)" : "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}>
            {p === "page1" ? (lang === "zh-CN" ? "第1页" : "第1頁") : (lang === "zh-CN" ? "第2页" : "第2頁")}
          </button>
        ))}
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
          {matrix ? `${lang === "zh-CN" ? "共" : "共"} ${matrix.totalPoints} ${lang === "zh-CN" ? "个有声数据方言点" : "個有聲數據方言點"}` : (lang === "zh-CN" ? "加载数据中..." : "載入資料中...")}
        </span>
      </div>
      {/* Heatmap */}
      <div ref={chartRef} style={{ flex: 1 }} />
    </div>
  );
}
