/**
 * ScatterView.tsx — 重心气泡图
 * 2707 方言点 → 按 broad 大类分组 → 重心气泡 + 内部散点
 * D3 zoom/pan + left legend panel + label checkbox + group click → synthetic point with metrics
 * v6.0: left 160px legend panel, rounded-rect color blocks, "未分类" filtered
 */
import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import type { DialectPoint } from "@/types";
import { BROAD_CATEGORIES } from "@/types";
import { LegendList, MetricStrip, RailSection, ResearchLayout, SegmentedControl } from "@/components/ui/ResearchLayout";

interface BubbleDatum {
  group: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  size: number;
  points: { x: number; y: number; id: string; name: string }[];
}

const LEGEND_CATEGORIES = BROAD_CATEGORIES.filter((c) => c !== "未分类");

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ScatterView() {
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dataCache = useAppStore((s) => s.dataCache);
  const selectedDialect = useAppStore((s) => s.selectedDialect);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const hoverDialect = useAppStore((s) => s.hoverDialect);
  const lang = useAppStore((s) => s.lang);
  const [showLabels, setShowLabels] = useState(true);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"density" | "circle">("density");
  const mdsSource = useAppStore((s) => s.mdsSource);
  const [lingMds, setLingMds] = useState<{ coords: [number,number][]; ids: string[]; groups: string[]; names: string[] } | null>(null);

  useEffect(() => {
    if (mdsSource === "ling") {
      fetch("/data/ling_mds_coords.json").then(r => r.json()).then(setLingMds).catch(() => {});
    }
  }, [mdsSource]);

  // Use GEO or LING MDS based on toggle
  const activeMds = mdsSource === "geo" ? dataCache?.mdsCoords : (lingMds ? { ...lingMds, groups: lingMds.groups || lingMds.ids.map(() => "未分类") } : null);

  const bubblesRef = useRef<BubbleDatum[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!chartRef.current) return;
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        setDims({ w: chartRef.current.clientWidth, h: chartRef.current.clientHeight });
      }
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mds = activeMds;
    const points = dataCache?.dialects?.points;
    if (!mds || !points || !chartRef.current) return;

    const el = chartRef.current;
    while (el.firstChild) el.removeChild(el.firstChild);
    const w = el.clientWidth || 500;
    const h = el.clientHeight || 400;
    const m = { t: 8, r: 8, b: 8, l: 8 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const { coords, ids } = mds;
    const groups = mds.groups || ids.map(() => "未分类");
    const names = mds.names || ids;

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("cursor", "grab");
    svgRef.current = svg.node();

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform as any);
      });
    svg.call(zoom);
    svg.on("dblclick.zoom", () => {
      svg
        .transition()
        .duration(350)
        .call(zoom.transform, d3.zoomIdentity);
    });

    const xE = d3.extent(coords, (d) => d[0]) as [number, number];
    const yE = d3.extent(coords, (d) => d[1]) as [number, number];
    const pad = 0.12;
    const xP = (xE[1] - xE[0]) * pad || 0.1;
    const yP = (yE[1] - yE[0]) * pad || 0.1;
    const xS = d3
      .scaleLinear()
      .domain([xE[0] - xP, xE[1] + xP])
      .range([0, iw]);
    const yS = d3
      .scaleLinear()
      .domain([yE[0] - yP, yE[1] + yP])
      .range([ih, 0]);

    const groupData = new Map<
      string,
      { coords: [number, number][]; ids: string[]; names: string[] }
    >();
    for (let i = 0; i < coords.length; i++) {
      const grp = groups[i] || "未分类";
      if (!groupData.has(grp)) {
        groupData.set(grp, { coords: [], ids: [], names: [] });
      }
      const gd = groupData.get(grp)!;
      gd.coords.push(coords[i]);
      gd.ids.push(ids[i]);
      gd.names.push(names[i]);
    }

    const maxGroupSize = d3.max(Array.from(groupData.values()), (gd) => gd.coords.length) || 1;
    const circleSize = d3.scaleSqrt().domain([1, maxGroupSize]).range([18, 78]);
    const bubbles: BubbleDatum[] = [];
    groupData.forEach((gd, group) => {
      const dcx = d3.mean(gd.coords, (c) => c[0])!;
      const dcy = d3.mean(gd.coords, (c) => c[1])!;
      const sx = xS(dcx);
      const sy = yS(dcy);
      const sz = gd.coords.length;
      const color = BROAD_COLORS[group] || BROAD_COLORS["未分类"];
      const realPts: BubbleDatum["points"] = gd.coords.map((coord, j) => ({
        x: xS(coord[0]),
        y: yS(coord[1]),
        id: gd.ids[j],
        name: gd.names[j],
      }));
      const distances = realPts.map((p) => Math.hypot(p.x - sx, p.y - sy));
      const sortedDist = distances.slice().sort(d3.ascending);
      const spreadRadius = Math.max(18, d3.quantile(sortedDist, 0.78) ?? 18);
      const maxDist = Math.max(...distances, 1);
      const r = viewMode === "circle" ? circleSize(sz) : spreadRadius;
      const pts = viewMode === "circle"
        ? (() => {
            const scale = (r * 0.9) / maxDist;
            return realPts.map((point) => ({
              ...point,
              x: sx + (point.x - sx) * scale,
              y: sy + (point.y - sy) * scale,
            }));
          })()
        : realPts;
      bubbles.push({
        group,
        cx: sx,
        cy: sy,
        r,
        color,
        size: sz,
        points: pts,
      });
    });
    bubblesRef.current = bubbles;

    if (viewMode === "density") {
      const contourPath = d3.geoPath();
      const contourLayer = g.append("g").attr("class", "density-contours");
      for (const bubble of bubbles.filter((b) => b.points.length >= 24)) {
        const contours = d3.contourDensity<{ x: number; y: number }>()
          .x((d) => d.x)
          .y((d) => d.y)
          .size([iw, ih])
          .bandwidth(Math.max(18, Math.min(34, bubble.r * 0.26)))
          .thresholds(5)(bubble.points);
        contourLayer
          .append("g")
          .attr("class", "bubble density-group")
          .datum(bubble)
          .selectAll("path")
          .data(contours.slice(-3))
          .join("path")
          .attr("d", contourPath as any)
          .attr("fill", "none")
          .attr("stroke", bubble.color)
          .attr("stroke-width", (_d, i) => 0.9 + i * 0.35)
          .attr("stroke-opacity", (_d, i) => 0.18 + i * 0.10)
          .style("pointer-events", "none");
      }
    }

    const bubbleG = g
      .append("g")
      .selectAll("g.bubble")
      .data(bubbles)
      .join("g")
      .attr("class", "bubble");

    bubbleG
      .append("circle")
      .attr("cx", (d) => d.cx)
      .attr("cy", (d) => d.cy)
      .attr("r", (d) => viewMode === "circle" ? d.r : 5.5)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", viewMode === "circle" ? 0.12 : 0.72)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", viewMode === "circle" ? 1.5 : 2.2)
      .attr("stroke-opacity", viewMode === "circle" ? 0.7 : 0.95)
      .style("cursor", "pointer")
      .on("mouseenter", function (_e, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill-opacity", viewMode === "circle" ? 0.22 : 0.94)
          .attr("stroke-width", 3.2);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill-opacity", viewMode === "circle" ? 0.12 : 0.72)
          .attr("stroke-width", viewMode === "circle" ? 1.5 : 2.2);
      })
      .on("click", (_e, d) => {
        const broadName = d.group;
        // For ling MDS, limit to only points present in MDS data
        const mdsIds = new Set(mds.ids);
        const members = points.filter((p) => 
          p.broad === broadName && (mdsSource === "geo" || mdsIds.has(p.id) || mdsIds.has(p.name))
        );

        const groupIndices = groups
          .map((g, i) => (g === broadName ? i : -1))
          .filter((i) => i >= 0);

        let intraSum = 0;
        let intraPairs = 0;
        for (let i = 0; i < groupIndices.length; i++) {
          for (let j = i + 1; j < groupIndices.length; j++) {
            const ci = groupIndices[i];
            const cj = groupIndices[j];
            const dx = coords[ci][0] - coords[cj][0];
            const dy = coords[ci][1] - coords[cj][1];
            intraSum += Math.sqrt(dx * dx + dy * dy);
            intraPairs++;
          }
        }
        const intraAvgDist = intraPairs > 0 ? intraSum / intraPairs : 0;

        const interDists: Record<string, number> = {};
        let nearestGroup = "";
        let nearestDist = Infinity;
        groupData.forEach((gd, grp) => {
          if (grp === broadName) return;
          const ocx = d3.mean(gd.coords, (c) => c[0])!;
          const ocy = d3.mean(gd.coords, (c) => c[1])!;
          const gdcx = d3.mean(
            groupData.get(broadName)!.coords,
            (c) => c[0],
          )!;
          const gdcy = d3.mean(
            groupData.get(broadName)!.coords,
            (c) => c[1],
          )!;
          const dist = Math.sqrt(
            (gdcx - ocx) ** 2 + (gdcy - ocy) ** 2,
          );
          interDists[grp] = dist;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestGroup = grp;
          }
        });

        const lats = members.map((m) => m.lat).filter((v) => v !== 0);
        const lngs = members.map((m) => m.lng).filter((v) => v !== 0);
        const geoSpanKm =
          lats.length >= 2 && lngs.length >= 2
            ? haversineKm(
                Math.min(...lats),
                Math.min(...lngs),
                Math.max(...lats),
                Math.max(...lngs),
              )
            : 0;

        const sp = {
          id: `__group__${broadName}`,
          name: broadName,
          title: broadName,
          lat: d3.mean(lats) || 0,
          lng: d3.mean(lngs) || 0,
          region: "",
          group: broadName,
          subgroup: "",
          broad: broadName as any,
          color: BROAD_COLORS[broadName] || "#a0a0a0",
          symbol: "circle",
          ydFenqu: "",
          csFenqu: "",
          source: "",
          contributor: "",
          location: "",
          markerColor: BROAD_COLORS[broadName] || "#a0a0a0",
          groupMembers: members.slice(0, 500),
          intraAvgDist,
          geoSpanKm,
          nearestGroup,
          nearestDist,
          interGroupDists: interDists,
        } as DialectPoint;
        selectDialect(
          selectedDialect?.id === `__group__${broadName}` ? null : sp,
        );
      });

    bubbleG
      .append("g")
      .selectAll("circle")
      .data((d) => d.points)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", mdsSource === "ling" ? 2.1 : 1.35)
      .attr("fill", (d) => {
        const p = points.find((pt) => pt.id === d.id);
        return BROAD_COLORS[p?.broad || ""] || BROAD_COLORS["未分类"];
      })
      .attr("fill-opacity", 0.76)
      .attr("stroke", "var(--bg-raised)")
      .attr("stroke-width", 0.25)
      .style("pointer-events", "none");

    bubbleG
      .append("text")
      .attr("class", "bubble-label")
      .attr("x", (d) => d.cx)
      .attr("y", (d) => viewMode === "circle" ? d.cy - d.r - 7 : d.cy - 16)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", (d) => d.color)
      .attr("font-family", "var(--font-serif)")
      .style("pointer-events", "none")
      .style("display", showLabels ? "block" : "none")
      .text((d) => d.group);
  }, [dataCache, selectDialect, hoverDialect, selectedDialect, dims, activeMds, mdsSource, viewMode]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    d3.select(svgEl)
      .selectAll<SVGTextElement, any>("text.bubble-label")
      .style("display", showLabels ? "block" : "none");
  }, [showLabels]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    d3.select(svgEl)
      .selectAll("g.bubble")
      .style("display", function () {
        const d = d3.select(this).datum() as BubbleDatum;
        return hiddenGroups.has(d.group) ? "none" : null;
      });
  }, [hiddenGroups]);

  const toggleGroup = (group: string) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  if (!dataCache?.mdsCoords && mdsSource === "geo") {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span className="loading-label">{lang === "zh-CN" ? "加载距离数据..." : "載入距離資料..."}</span>
      </div>
    );
  }

  const visibleGroups = LEGEND_CATEGORIES.filter((cat) => !hiddenGroups.has(cat)).length;
  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "图形表达" : "圖形表達"}>
        <SegmentedControl
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "density", label: lang === "zh-CN" ? "点云密度" : "點雲密度" },
            { value: "circle", label: lang === "zh-CN" ? "气泡聚合" : "氣泡聚合" },
          ]}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "当前空间" : "當前空間"}>
        <MetricStrip
          items={[
            { label: "MDS", value: mdsSource === "geo" ? "Geo" : "Ling", tone: "accent" },
            { label: lang === "zh-CN" ? "显示大类" : "顯示大類", value: visibleGroups },
          ]}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "图层" : "圖層"}>
        <label className="rail-check">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          <span>{lang === "zh-CN" ? "显示大类标签" : "顯示大類標籤"}</span>
        </label>
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "方言大类" : "方言大類"}>
        <LegendList
          items={LEGEND_CATEGORIES.map((cat) => ({
            key: cat,
            label: cat,
            color: BROAD_COLORS[cat],
            active: !hiddenGroups.has(cat),
            onClick: () => toggleGroup(cat),
          }))}
        />
      </RailSection>
    </>
  );

  return (
    <ResearchLayout
      rail={rail}
      railKicker="MDS"
      railTitle={mdsSource === "geo"
        ? (lang === "zh-CN" ? "地理距离空间" : "地理距離空間")
        : (lang === "zh-CN" ? "语音距离空间" : "語音距離空間")}
    >
      <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
    </ResearchLayout>
  );
}
