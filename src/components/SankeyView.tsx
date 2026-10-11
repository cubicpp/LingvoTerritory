/**
 * SankeyView.tsx — 声韵流图：中古音声母 → 韵摄
 * Data: mc_phonology.json sheMatrix[98 initials][16 she]
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as echarts from "echarts";
import { useAppStore } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { LegendList, MetricStrip, RailSection, ResearchLayout, SegmentedControl } from "@/components/ui/ResearchLayout";

interface PhonologyData {
  initials: string[];
  she: string[];
  sheMatrix: number[][];
}

function stripKH(name: string): string {
  return name.replace(/(開|合|é–‹|åˆ)$/u, "");
}

export function SankeyView() {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const dk = theme === "dark";
  const [data, setData] = useState<PhonologyData | null>(null);
  const [merged, setMerged] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    fetch("/data/mc_phonology.json")
      .then((r) => r.json())
      .then((d) => setData(d as PhonologyData))
      .catch(() => {});
  }, []);

  const sankeyData = useMemo(() => {
    if (!data) return { nodes: [] as { name: string; itemStyle?: { color: string } }[], links: [] as { source: string; target: string; value: number }[] };

    const initials = data.initials;
    const sheList = data.she;
    const matrix = data.sheMatrix;

    let srcLabels: string[];
    let aggMatrix: number[][];

    if (merged) {
      // Group by base initial (strip 開/合)
      const baseMap = new Map<string, number[]>();
      const baseOrder: string[] = [];
      for (let i = 0; i < initials.length; i++) {
        const base = stripKH(initials[i]);
        if (!baseMap.has(base)) {
          baseMap.set(base, new Array(sheList.length).fill(0));
          baseOrder.push(base);
        }
        const row = baseMap.get(base)!;
        for (let j = 0; j < sheList.length; j++) {
          row[j] += matrix[i]?.[j] ?? 0;
        }
      }
      srcLabels = baseOrder;
      aggMatrix = baseOrder.map((b) => baseMap.get(b)!);
    } else {
      srcLabels = initials;
      aggMatrix = matrix;
    }

    const nodes: { name: string; depth?: number; label?: Record<string, unknown> }[] = [];
    for (const s of srcLabels) {
      nodes.push({
        name: s,
        depth: 0,
        label: { position: "left", align: "right", distance: 8 },
      });
    }
    for (const s of sheList) {
      nodes.push({
        name: s,
        depth: 1,
        label: { position: "right", align: "left", distance: 8 },
      });
    }

    const links: { source: string; target: string; value: number }[] = [];
    for (let i = 0; i < srcLabels.length; i++) {
      const row = aggMatrix[i];
      if (!row) continue;
      for (let j = 0; j < sheList.length; j++) {
        const v = row[j];
        if (v && v > (merged ? 0 : 1)) {
          links.push({ source: srcLabels[i], target: sheList[j], value: v });
        }
      }
    }

    return { nodes, links };
  }, [data, merged]);

  const renderChart = useCallback(() => {
    if (!containerRef.current || sankeyData.nodes.length === 0) return;

    if (chartRef.current) {
      safeDispose(chartRef.current);
      chartRef.current = null;
    }

    const chart = echarts.init(containerRef.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    const height = containerRef.current.clientHeight || 640;
    const maxColumnNodes = Math.max(16, sankeyData.nodes.filter((node: any) => node.depth === 0).length);
    const nodeGap = Math.max(2, Math.min(merged ? 12 : 5, Math.floor((height - 80) / maxColumnNodes)));

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: dk ? "#181d28" : "#fff",
        borderColor: dk ? "#282d38" : "#e5e0d5",
        textStyle: { color: dk ? "#e8e4df" : "#1a1814", fontSize: 13 },
        formatter: (params: any) => {
          if (params.dataType === "edge") {
            return `${params.data.source} → ${params.data.target}<br/>字数: <b>${params.data.value}</b>`;
          }
          return `${params.name}`;
        },
      },
      series: [
        {
          type: "sankey",
          left: 92,
          right: 92,
          top: 18,
          bottom: 18,
          layoutIterations: 64,
          nodeAlign: "justify",
          nodeWidth: merged ? 14 : 8,
          nodeGap,
          draggable: false,
          emphasis: { focus: "adjacency" },
          label: {
            show: true,
            overflow: "truncate",
            width: 78,
            fontSize: merged ? 11 : 9,
            color: dk ? "#e8e4df" : "#1a1814",
            fontFamily: "var(--font-serif)",
          },
          lineStyle: {
            color: "gradient",
            curveness: 0.46,
            opacity: merged ? 0.36 : 0.24,
          },
          levels: [
            { depth: 0, itemStyle: { color: dk ? "#9b6a45" : "#b56a3f" } },
            { depth: 1, itemStyle: { color: dk ? "#668a7c" : "#5f8e7f" } },
          ],
          data: sankeyData.nodes,
          links: sankeyData.links,
        },
      ],
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      safeDispose(chart);
      chartRef.current = null;
    };
  }, [sankeyData, dk]);

  useEffect(() => {
    const cleanup = renderChart();
    return () => { cleanup?.(); };
  }, [renderChart]);

  const totalChars = sankeyData.links.reduce((s, l) => s + l.value, 0);
  const topFlows = useMemo(() => [...sankeyData.links].sort((a, b) => b.value - a.value).slice(0, 8), [sankeyData.links]);

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span>{lang === "zh-CN" ? "加载数据..." : "載入資料..."}</span>
      </div>
    );
  }

  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "粒度" : "粒度"}>
        <SegmentedControl
          value={merged ? "merged" : "split"}
          onChange={(value) => setMerged(value === "merged")}
          options={[
            { value: "merged", label: lang === "zh-CN" ? "合并开合" : "合併開合" },
            { value: "split", label: lang === "zh-CN" ? "细分开合" : "細分開合" },
          ]}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "流量规模" : "流量規模"}>
        <MetricStrip
          items={[
            { label: lang === "zh-CN" ? "连线" : "連線", value: sankeyData.links.length, tone: "accent" },
            { label: lang === "zh-CN" ? "字次" : "字次", value: totalChars },
          ]}
        />
      </RailSection>
      {topFlows.length > 0 ? (
        <RailSection title={lang === "zh-CN" ? "Top flows" : "Top flows"}>
          <LegendList
            items={topFlows.map((link) => ({
              key: `${link.source}-${link.target}`,
              label: `${link.source} → ${link.target}`,
              value: link.value,
              color: "var(--accent)",
            }))}
          />
        </RailSection>
      ) : null}
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Flow" railTitle={lang === "zh-CN" ? "声韵流量" : "聲韻流量"}>
      <div ref={containerRef} style={{ flex: 1, width: "100%", height: "100%", minHeight: 0 }} />
    </ResearchLayout>
  );
}
