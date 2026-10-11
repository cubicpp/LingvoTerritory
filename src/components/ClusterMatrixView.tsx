/**
 * ClusterMatrixView.tsx — 方言相似度全量矩阵（按方言大类分组）
 */
import { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";

const GROUP_COLORS: Record<string, string> = {
  "官話": "#E74C3C", "吳語": "#2ECC71", "粵語": "#3498DB",
  "閩語": "#F39C12", "客語": "#1ABC9C", "贛語": "#9B59B6",
  "湘語": "#E67E22", "晉語": "#E91E63", "徽語": "#795548",
  "平話": "#607D8B", "其他土話": "#999",
};

export function ClusterMatrixView() {
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const [simData, setSimData] = useState<{ dialects: string[]; groups: string[]; matrix: number[][] } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    fetch("/data/ling_sim_matrix.json").then(r => r.json()).then(setSimData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!simData || !chartRef.current) return;
    if (chart.current) { safeDispose(chart.current); chart.current = null; }

    const { dialects, groups, matrix } = simData;
    const n = dialects.length;

    // Build group boundaries for axis coloring
    const groupStarts: number[] = [];
    const groupLabels: string[] = [];
    let prev = "";
    for (let i = 0; i < n; i++) {
      if (groups[i] !== prev) {
        groupStarts.push(i);
        groupLabels.push(groups[i]);
        prev = groups[i];
      }
    }

    // Color map for axes
    const axisColors = groups.map((g, i) => GROUP_COLORS[g] || "#999");
    const mid = Math.floor(groupLabels.length / 2);
    // Only show group separator labels
    const xAxisLabels = groups.map((g, i) => {
      if (i === 0 || groups[i] !== groups[i - 1]) return g;
      return "";
    });

    const c = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    chart.current = c;

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter: (p: any) => {
          const row = dialects[p.value[1]] || "";
          const col = dialects[p.value[0]] || "";
          return `${row}<br/>${col}<br/>相似度: ${(p.value[2] as number).toFixed(4)}`;
        },
      },
      grid: { left: 120, top: 20, right: 20, bottom: 80 },
      dataZoom: [{ type: "inside", xAxisIndex: 0 }, { type: "inside", yAxisIndex: 0 }],
      xAxis: {
        type: "category", data: dialects,
        axisLabel: {
          show: true, rotate: 90, fontSize: 7,
          interval: 0,
          formatter: (v: string, i: number) => xAxisLabels[i],
          color: (v: string, i: number) => axisColors[i],
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category", data: dialects,
        axisLabel: {
          show: true, fontSize: 7, interval: 0,
          formatter: (v: string, i: number) => xAxisLabels[i],
          color: (v: string, i: number) => axisColors[i],
        },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0, max: 1,
        calculable: true, orient: "horizontal",
        left: "center", bottom: 10,
        inRange: { color: ["#3498DB", "#eee", "#E74C3C"] },
        text: [lang === "zh-CN" ? "高相似" : "高相似", lang === "zh-CN" ? "低相似" : "低相似"],
      },
      series: [{
        type: "heatmap",
        data: matrix.flatMap((row, i) => row.map((v, j) => [j, i, v])),
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.3)" } },
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(c); chart.current = null; };
  }, [simData]);

  if (!simData) {
    return <div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载矩阵..." : "載入矩陣..."}</span></div>;
  }

  return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
}
