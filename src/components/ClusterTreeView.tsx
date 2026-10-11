/**
 * ClusterTreeView.tsx — 方言聚类树状图 (Dendrogram, 从左到右)
 */
import { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";

interface TreeNode {
  name: string;
  group?: string;
  distance?: number;
  children?: TreeNode[];
}

function flattenTree(node: TreeNode, depth: number, path: string, result: any[]) {
  if (node.children && node.children.length > 0) {
    result.push({
      name: node.name || `dist:${node.distance || 0}`,
      value: node.distance || 0,
      depth,
      path,
      itemStyle: { color: "transparent" },
      children: [],
    });
    node.children.forEach((child, i) => {
      flattenTree(child, depth + 1, `${path}/${i}`, result[result.length - 1].children);
    });
  } else {
    const color = BROAD_COLORS[node.group || ""] || "#a0a0a0";
    result.push({
      name: node.name,
      depth,
      path,
      itemStyle: { color, borderColor: color },
      label: { fontSize: 9, color },
    });
  }
}

export function ClusterTreeView() {
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const [treeData, setTreeData] = useState<any | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    fetch("/data/ling_cluster.json").then(r => r.json()).then(setTreeData).catch(() => {});
  }, []);

  useEffect(() => {
    if (!treeData || !chartRef.current) return;
    if (chart.current) { safeDispose(chart.current); chart.current = null; }

    // Convert tree to ECharts format (left-to-right)
    const flat: any[] = [];
    flattenTree(treeData, 0, "0", flat);

    const c = echarts.init(chartRef.current, theme === "dark" ? "dark" : undefined);
    chart.current = c;

    c.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: (p: any) => p.name || `距离: ${p.value}` },
      series: [{
        type: "tree",
        data: flat,
        top: "5%", left: "2%", bottom: "5%", right: "8%",
        symbolSize: 5,
        orient: "LR",
        label: {
          position: "right", verticalAlign: "middle", align: "left",
          fontSize: 9,
        },
        leaves: {
          label: { position: "right", verticalAlign: "middle", align: "left", fontSize: 9 },
        },
        emphasis: { focus: "descendant" },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); safeDispose(c); chart.current = null; };
  }, [treeData]);

  if (!treeData) {
    return <div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载聚类树..." : "載入聚類樹..."}</span></div>;
  }

  return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
}
