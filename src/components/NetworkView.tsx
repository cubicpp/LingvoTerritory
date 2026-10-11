/**
 * NetworkView.tsx — 方言相似度网络图
 * D3 force-directed graph of dialect similarity based on geographic proximity
 */
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import type { DialectPoint } from "@/types";

const MAX_NODES = 150;
const MAX_EDGES = 400;

export function NetworkView() {
  const ref = useRef<HTMLDivElement>(null);
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const lang = useAppStore((s) => s.lang);

  useEffect(() => {
    if (!ref.current || !dialects) return;

    try {
      const el = ref.current;
      el.innerHTML = "";
      const w = el.clientWidth || 600;
      const h = el.clientHeight || 500;

      // Sample representative points
      const points = dialects.points;
      const step = Math.max(1, Math.floor(points.length / MAX_NODES));
      const sampled = points.filter((_p, i) => i % step === 0).slice(0, MAX_NODES);

      // Build edges: connect each node to its 3 nearest neighbors
      const edges: { source: string; target: string; dist: number }[] = [];
      for (const a of sampled) {
        const neighbors = sampled
          .filter((b) => b.id !== a.id)
          .map((b) => ({
            id: b.id,
            dist: Math.sqrt((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2),
          }))
          .sort((x, y) => x.dist - y.dist)
          .slice(0, 3);
        for (const n of neighbors) {
          edges.push({ source: a.id, target: n.id, dist: n.dist });
        }
      }

      // Deduplicate edges
      const edgeSet = new Set<string>();
      const uniqueEdges = edges.filter((e) => {
        const key = [e.source, e.target].sort().join("||");
        if (edgeSet.has(key)) return false;
        edgeSet.add(key);
        return true;
      }).slice(0, MAX_EDGES);

      // D3 force simulation
      const svg = d3.select(el).append("svg").attr("width", w).attr("height", h);
      const g = svg.append("g");

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 5])
        .on("zoom", (e) => g.attr("transform", e.transform));
      svg.call(zoom);

      const nodes = sampled.map((d) => ({ id: d.id, name: d.title || d.name, broad: d.broad, x: w / 2, y: h / 2 }));
      const links = uniqueEdges.map((e) => ({ source: e.source, target: e.target, dist: e.dist }));

      const simulation = d3.forceSimulation(nodes as any)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => d.dist * 400))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("center", d3.forceCenter(w / 2, h / 2))
        .force("collision", d3.forceCollide(8));

      // Draw links
      const link = g.selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.4);

      // Draw nodes
      const node = g.selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 4)
        .attr("fill", (d: any) => BROAD_COLORS[d.broad] || "#a0a0a0")
        .attr("fill-opacity", 0.8)
        .attr("stroke", "var(--bg-raised)")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("click", (_e: any, d: any) => {
          const pt = dialects.points.find((p) => p.id === d.id);
          if (pt) selectDialect(pt);
        })
        .append("title")
        .text((d: any) => `${d.name} — ${d.broad}`);

      // Labels for prominent nodes
      g.selectAll("text")
        .data(nodes.filter((_n, i) => i % 8 === 0))
        .join("text")
        .text((d: any) => d.name.length > 4 ? d.name.slice(0, 3) + "…" : d.name)
        .attr("font-size", 7)
        .attr("fill", "var(--text-tertiary)")
        .attr("dx", 6)
        .attr("dy", 3)
        .style("pointer-events", "none");

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);
        node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
        g.selectAll("text")
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y);
      });

      return () => { simulation.stop(); };
    } catch (err) {
      console.error("NetworkView render error:", err);
    }
  }, [dialects, selectDialect]);

  if (!dialects) {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span>{lang === "zh-CN" ? "加载数据..." : "載入資料..."}</span>
      </div>
    );
  }

  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}
