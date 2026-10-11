/**
 * ClusterView.tsx — 方言聚类树状图 (Ward hierarchical clustering)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { LegendList, RailSection, ResearchLayout } from "@/components/ui/ResearchLayout";

export function ClusterView() {
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const [tree, setTree] = useState<any>(null);
  const [filterBroad, setFilterBroad] = useState<string>("");
  const [query, setQuery] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const dk = theme === "dark";

  useEffect(() => {
    fetch("/data/ling_cluster.json").then(r => r.json()).then(setTree).catch(() => {});
  }, []);

  const availableGroups = useMemo(() => {
    const counts = new Map<string, number>();
    function walk(node: any) {
      if (!node) return;
      if (!node.children) {
        const group = node.group || "未知";
        counts.set(group, (counts.get(group) || 0) + 1);
        return;
      }
      for (const child of node.children) walk(child);
    }
    walk(tree);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [tree]);

  const displayTree = useMemo(() => {
    if (!tree) return null;
    const q = query.trim().toLowerCase();
    function cloneAndFilter(node: any): any | null {
      if (!node.children) {
        const groupOk = !filterBroad || node.group === filterBroad;
        const queryOk = !q || String(node.name || "").toLowerCase().includes(q);
        return groupOk && queryOk ? { ...node } : null;
      }
      const children = (node.children || []).map(cloneAndFilter).filter(Boolean);
      if (children.length === 0) return null;
      return { ...node, children };
    }
    return cloneAndFilter(tree) || tree;
  }, [tree, filterBroad, query]);

  useEffect(() => {
    if (!displayTree || !chartRef.current) return;
    if (chart.current) { safeDispose(chart.current); chart.current = null; }

    const c = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    chart.current = c;

    function groupCounts(node: any): Map<string, number> {
      if (!node.children) return new Map([[node.group || "未知", 1]]);
      const counts = new Map<string, number>();
      for (const child of node.children || []) {
        for (const [group, count] of groupCounts(child)) {
          counts.set(group, (counts.get(group) || 0) + count);
        }
      }
      return counts;
    }

    function decorate(node: any, depth: number) {
      if (!node.children) {
        node.symbol = "circle";
        node.symbolSize = 4;
        node.label = { position: "right", fontSize: 10, color: dk ? "#a39d96" : "#5c5650", fontFamily: "var(--font, sans-serif)" };
        node.itemStyle = { color: BROAD_COLORS[node.group] || "#999", borderColor: "transparent", borderWidth: 0 };
      } else {
        const counts = groupCounts(node);
        const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
        const [dominantGroup, dominantCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] || ["", 0];
        const purity = total ? dominantCount / total : 0;
        const branchColor = purity >= 0.72 ? (BROAD_COLORS[dominantGroup] || (dk ? "#3a3a4a" : "#d6d3d1")) : (dk ? "#4a4d57" : "#b8b3aa");
        node.symbol = "emptyCircle";
        node.symbolSize = purity >= 0.72 ? 4 : 3;
        node.itemStyle = { color: branchColor, borderColor: "transparent", opacity: Math.max(0.35, purity) };
        node.label = { show: false };
        node.lineStyle = { color: branchColor, width: purity >= 0.72 ? 1.8 : 1, opacity: Math.max(0.35, purity) };
        node.purity = purity;
        node.dominantGroup = dominantGroup;
        for (const child of node.children || []) decorate(child, depth + 1);
      }
    }
    decorate(displayTree, 0);

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: dk ? "#1a1a2e" : "#fff",
        borderColor: dk ? "#333" : "#ddd",
        textStyle: { color: dk ? "#e8e4df" : "#1a1814", fontSize: 11 },
        formatter: (p: any) => {
          if (!p.data.children) return `${p.name}<br/><span style="color:var(--text-tertiary)">${p.data.group || ""}</span>`;
          const purity = p.data.purity ? `${Math.round(p.data.purity * 100)}%` : "";
          const group = p.data.dominantGroup ? `<br/>主导类: ${p.data.dominantGroup}` : "";
          const dist = p.data.distance ? `<br/>距离: ${p.data.distance.toFixed(2)}` : "";
          return `分支纯度: ${purity}${group}${dist}`;
        },
      },
      series: [{
        type: "tree",
        data: [displayTree],
        left: "1%", right: "18%", top: "3%", bottom: "3%",
        orient: "LR",
        expandAndCollapse: false,
        initialTreeDepth: -1,
        roam: true,
        symbolSize: 4,
        edgeShape: "curve",
        edgeForkPosition: "63%",
        animationDuration: 400,
        animationDurationUpdate: 200,
        label: { position: "left", verticalAlign: "middle", align: "right", fontSize: 9, color: dk ? "#78736d" : "#8c857a" },
        leaves: { label: { position: "right", verticalAlign: "middle", align: "left", fontSize: 10, color: dk ? "#a39d96" : "#5c5650" } },
        emphasis: { focus: "descendant", lineStyle: { width: 2, color: dk ? "#666" : "#999" } },
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(c); chart.current = null; };
  }, [displayTree, dk]);

  if (!tree) return <div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载聚类..." : "載入聚類..."}</span></div>;

  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "检索" : "檢索"}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === "zh-CN" ? "搜索方言点" : "搜尋方言點"}
          style={{
            width: "100%",
            padding: "6px 8px",
            marginBottom: 8,
            border: "0.5px solid var(--border)",
            background: "var(--bg-overlay)",
            color: "var(--text)",
            fontFamily: "var(--font)",
            fontSize: 12,
          }}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "大类过滤" : "大類篩選"}>
        <LegendList
          items={availableGroups.slice(0, 12).map(([group, count]) => ({
            key: group,
            label: group,
            value: count,
            color: BROAD_COLORS[group] || "#999",
            active: !filterBroad || filterBroad === group,
            onClick: () => setFilterBroad(filterBroad === group ? "" : group),
          }))}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "读法" : "讀法"}>
        <p style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: "var(--text-tertiary)" }}>
          {lang === "zh-CN" ? "过滤后保留相关叶节点及其祖先分支，用于检查大类是否在聚类中稳定成团。" : "篩選後保留相關葉節點及其祖先分支，用於檢查大類是否在聚類中穩定成團。"}
        </p>
      </RailSection>
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Cluster" railTitle={lang === "zh-CN" ? "分类稳定性" : "分類穩定性"}>
      <div ref={chartRef} style={{ flex: 1, width: "100%" }} />
    </ResearchLayout>
  );
}
