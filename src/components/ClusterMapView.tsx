/**
 * ClusterMapView.tsx — 方言聚类地图（按语音聚类着色）
 */
import { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useAppStore } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";

const CLUSTER_COLORS = ["#E74C3C","#3498DB","#2ECC71","#F39C12","#9B59B6","#1ABC9C","#E67E22","#E91E63","#795548","#607D8B","#FF5722","#009688","#673AB7","#CDDC39","#03A9F4"];

export function ClusterMapView() {
  const lang = useAppStore((s) => s.lang);
  const china = useAppStore((s) => s.dataCache.china);
  const theme = useAppStore((s) => s.theme);
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const [clusterData, setClusterData] = useState<{ labels: number[]; dialects: string[]; n_clusters: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    fetch("/data/ling_cluster_labels.json").then(r => r.json()).then(setClusterData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!clusterData || !china || !chartRef.current) return;
    if (chart.current) { safeDispose(chart.current); chart.current = null; }

    echarts.registerMap("china", china as any);
    const c = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    chart.current = c;

    // Build point → cluster mapping + get coordinates from dialects
    const ptCluster: Record<string, number> = {};
    clusterData.dialects.forEach((d, i) => { ptCluster[d] = clusterData.labels[i]; });

    const scatterData: any[] = [];
    if (dialects?.points) {
      for (const p of dialects.points) {
        if (!p.lat || !p.lng) continue;
        const cid = ptCluster[p.id] || ptCluster[p.name || ""];
        if (cid === undefined) continue;
        scatterData.push({
          name: p.id,
          value: [p.lng, p.lat, cid],
          itemStyle: { color: CLUSTER_COLORS[(cid - 1) % CLUSTER_COLORS.length] },
        });
      }
    }

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: any) => `${p.name}<br/>${lang === "zh-CN" ? "聚类" : "聚類"} #${p.value[2]}`,
      },
      geo: {
        map: "china", roam: true, zoom: 1.2, center: [108, 34],
        itemStyle: { areaColor: "#f0ece0", borderColor: "#d6d3d1" },
      },
      legend: {
        data: Array.from({ length: clusterData.n_clusters }, (_, i) => `${lang === "zh-CN" ? "聚类" : "聚類"} ${i + 1}`),
        bottom: 10,
        textStyle: { fontSize: 10 },
      },
      series: [{
        type: "scatter", coordinateSystem: "geo",
        data: scatterData,
        symbolSize: 8,
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(c); chart.current = null; };
  }, [clusterData, china, dialects]);

  if (!clusterData) {
    return <div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载聚类数据..." : "載入聚類數據..."}</span></div>;
  }

  return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
}
