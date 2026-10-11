/**
 * TreeView.tsx — 分类谱系（双模式）
 * 模式1: 径向树 — 地图集二分區
 * 模式2: ECharts 矩形式树图 — 音典分區
 * 右上角 🌳 / ◎ 切换
 * v5.7: treemap legend rounded rectangles
 */
import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import * as d3 from "d3";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import type { TreeNode, DialectPoint } from "@/types";

type TreeMode = "radial" | "treemap";

const TREEMAP_COLORS = [
  "#c43a31", "#4a7c59", "#d4926a", "#e8b44a", "#7b9e6d", "#8e6b4f",
  "#6b8e8a", "#c08060", "#a09080", "#b0a080", "#8c7a6a", "#9a8a6a",
  "#d4a0a0", "#6080a0", "#80a060", "#a0a0a0",
];

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const LIGHTER_TREEMAP_COLORS = TREEMAP_COLORS.map((c) => lightenHex(c, 55));

export function TreeView() {
  const ref = useRef<HTMLDivElement>(null);
  const treemapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const dataCache = useAppStore((s) => s.dataCache);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const hoverDialect = useAppStore((s) => s.hoverDialect);
  const mode = useAppStore((s) => s.treeMode);
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);

  const points = dataCache?.dialects?.points ?? [];

  // Build map keyed by "broad||region" for precise matching
  const groupPointMap = useMemo(() => {
    const map = new Map<string, DialectPoint[]>();
    for (const p of points) {
      const broad = p.broad || "";
      const region = p.region || "";
      if (!broad) continue;
      const key = broad + "||" + region;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [points]);

  const createGroupPoint = useCallback(
    (ancestors: string[]): DialectPoint | null => {
      const leaf = ancestors[0] || "";
      const broad = ancestors[2] || "";
      const region = ancestors[1] || "";
      const key = broad + "||" + region;
      let members = groupPointMap.get(key) || [];
      if (members.length === 0) {
        for (const p of points) {
          if (p.broad === broad) members.push(p);
        }
      }
      if (leaf && leaf !== region && leaf !== broad && members.length > 0) {
        const narrowed = members.filter((p) => p.group === leaf || p.subgroup === leaf);
        if (narrowed.length > 0) members = narrowed;
      }
      if (members.length === 0) return null;
      const displayName = leaf || region || broad;
      return {
        id: "__group__" + key + "||" + leaf,
        name: displayName,
        title: displayName,
        lat: 0,
        lng: 0,
        region,
        group: "",
        subgroup: "",
        broad: broad as any,
        color: "",
        symbol: "",
        ydFenqu: "",
        csFenqu: "",
        source: "",
        contributor: "",
        location: "",
        markerColor: "",
        groupMembers: members.slice(0, 500),
      } as DialectPoint;
    },
    [groupPointMap, points],
  );

  const ydTree = useMemo(() => {
    if (!points.length) return null;
    const root: any = { name: "音典分區", children: [] };
    const m = new Map<string, any>();
    for (const d of points) {
      const parts = (d.ydFenqu || "").split("－");
      const l1 = parts[0];
      if (!l1) continue;
      if (parts.length < 2) {
        const k1 = l1;
        if (!m.has(k1)) {
          const n = { name: l1, children: [] };
          root.children.push(n);
          m.set(k1, n);
        }
        m.get(k1).children.push({
          name: d.title || d.name,
          value: 1,
        });
        continue;
      }
      const l2 = parts[1];
      const l3 = parts[2] || "";
      const k1 = l1;
      const k2 = `${l1}||${l2}`;
      if (!m.has(k1)) {
        const n = { name: l1, children: [] };
        root.children.push(n);
        m.set(k1, n);
      }
      if (!m.has(k2)) {
        const n = { name: l2, children: [] };
        m.get(k1).children.push(n);
        m.set(k2, n);
      }
      m.get(k2).children.push({
        name: d.title || l3 || d.name,
        value: 1,
      });
    }
    return root;
  }, [points]);

  const smallZones = useMemo(() => {
    if (!ydTree?.children) return [];
    return ydTree.children
      .map((zone: any, i: number) => {
        const count = zone.children?.reduce(
          (acc: number, c: any) =>
            acc +
            (c.children?.reduce(
              (a2: number, c2: any) => a2 + (c2.value || 0),
              0,
            ) || 0),
          0,
        ) || zone.children?.length || 0;
        return {
          name: zone.name,
          count,
          color: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
        };
      })
      .filter((z: any) => z.count <= 10);
  }, [ydTree]);

  // ─── Radial Tree ───
  const [radialResize, setRadialResize] = useState(0);

  useEffect(() => {
    if (mode !== "radial" || !ref.current) return;
    const ro = new ResizeObserver(() => setRadialResize((n) => n + 1));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "radial" || !ref.current || !dataCache?.dialects?.tree) return;
    const el = ref.current;
    while (el.firstChild) el.removeChild(el.firstChild);
    const w = el.clientWidth || 500;
    const h = el.clientHeight || 400;
    const radius = Math.min(w, h) / 2 - 44;

    const svg = d3.select(el).append("svg").attr("width", w).attr("height", h);
    const gRoot = svg.append("g").attr("transform", `translate(${w / 2},${h / 2})`);
    const g = gRoot.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
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

    const filterEmpty = (node: TreeNode): TreeNode | null => {
      if (!node.name && !(node as any).value) return null;
      if (!node.children) return { ...node };
      const filtered = node.children
        .map(filterEmpty)
        .filter(Boolean) as TreeNode[];
      return { ...node, children: filtered.length > 0 ? filtered : undefined };
    };
    const cleanTree = filterEmpty(dataCache.dialects.tree) || dataCache.dialects.tree;

    const root = d3
      .tree<TreeNode>()
      .size([2 * Math.PI, radius])
      .separation(() => 1)(
        d3.hierarchy(cleanTree).sort((a, b) => {
          const ca = (a.children?.length || 0);
          const cb = (b.children?.length || 0);
          if (ca <= 3 && cb <= 3) return Math.random() - 0.5;
          return cb - ca;
        }),
      ) as any;

    g.append("g")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 0.5)
      .attr(
        "d",
        d3
          .linkRadial<any, any>()
          .angle((d: any) => d.x)
          .radius((d: any) => d.y) as any,
      );

    const nodeG = g
      .append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr(
        "transform",
        (d: any) =>
          `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`,
      );

    nodeG
      .append("circle")
      .attr("r", (d: any) => (d.children ? 2.5 : 5))
      .attr("fill", (d: any) => {
        const anc = d.ancestors().map((a: any) => a.data.name);
        return BROAD_COLORS[anc[2]] || "#a0a0a0";
      })
      .attr("stroke", (d: any) =>
        d.children ? "none" : "var(--bg-raised)",
      )
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", function (_e: any, d: any) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", (d.children ? 2.5 : 5) * 1.5);
        if (!d.children) {
          const anc = d.ancestors().map((a: any) => a.data.name);
          const broad = anc[2] || "";
          const region = anc[1] || "";
          const key = broad + "||" + region;
          const members = groupPointMap.get(key);
          if (members?.length) hoverDialect(members[0].id);
        }
      })
      .on("mouseleave", function (_e: any, d: any) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", d.children ? 2.5 : 5);
        hoverDialect(null);
      })
      .on("click", (_e: any, d: any) => {
        const anc = d.ancestors().map((a: any) => a.data.name);
        const sp = createGroupPoint(anc);
        if (sp) selectDialect(sp);
      });

    nodeG
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d: any) => (d.x < Math.PI ? 8 : -8))
      .attr("text-anchor", (d: any) =>
        d.x < Math.PI ? "start" : "end",
      )
      .attr("transform", (d: any) =>
        d.x >= Math.PI ? "rotate(180)" : null,
      )
      .text((d: any) => {
        let n = d.data.name.replace(/\[.*?\]/g, "").trim();
        if (!n && (d.data as any).value) {
          n = d.parent?.data?.name || "";
        }
        if (d.depth >= 2 && n.length > 8) return n.slice(0, 7) + "…";
        return n;
      })
      .attr("font-size", (d: any) =>
        d.depth === 0
          ? "12px"
          : d.depth === 1
            ? "10px"
            : d.depth === 2
              ? "8px"
              : "6px",
      )
      .attr("fill", (d: any) =>
        d.depth === 0
          ? "var(--text)"
          : d.depth === 1
            ? "var(--text-secondary)"
            : "var(--text-tertiary)",
      )
      .attr("font-weight", (d: any) => (d.depth <= 1 ? 600 : 400))
      .attr("font-family", "var(--font-serif)")
      .style("pointer-events", "none");
  }, [mode, dataCache, groupPointMap, createGroupPoint, selectDialect, hoverDialect, radialResize]);

  // ─── ECharts Treemap (one-level) ───
  useEffect(() => {
    if (mode !== "treemap" || !ydTree) return;

    const container = treemapRef.current;
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

    if (chartRef.current) {
      safeDispose(chartRef.current);
      chartRef.current = null;
    }

    try {
      const chart = echarts.init(container, theme === "dark" ? "dark" : undefined);
      chartRef.current = chart;

      const dk = theme === "dark";

      const zones = ydTree.children || [];
      const zoneData = zones
        .filter((z: any) => z.name)
        .map((zone: any, i: number) => ({
          name: zone.name,
          value:
            zone.children?.reduce(
              (acc: number, c: any) =>
                acc +
                (c.children?.reduce(
                  (a2: number, c2: any) => a2 + (c2.value || 0),
                  0,
                ) || 0),
              0,
            ) || zone.children?.length || 1,
          itemStyle: { color: TREEMAP_COLORS[i % TREEMAP_COLORS.length] },
        }));

      const option: echarts.EChartsOption = {
        backgroundColor: "transparent",
        tooltip: {
          formatter: (params: any) => {
            const d = params.data;
            if (!d?.name) return "";
            return `${d.name}<br/>${lang === "zh-CN" ? `${d.value ?? 0} 个方言点` : `${d.value ?? 0} 個方言點`}`;
          },
        },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            data: zoneData,
            levels: [
              {
                itemStyle: {
                  borderWidth: 3,
                  borderColor: dk ? "#2a241e" : "transparent",
                  gapWidth: 2,
                },
              },
            ],
            label: {
              show: true,
              fontSize: 11,
              fontWeight: "bold" as const,
              color: dk ? "#e8e4df" : "#3d3226",
              formatter: (p: any) => (p.value || 0) <= 10 || !p.name ? "" : `${p.name} (${p.value || 0})`,
            },
            upperLabel: {
              show: true,
              formatter: (p: any) => p.name || "",
            },
          },
        ],
      };

      chart.setOption(option);

      chart.on("click", (params: any) => {
        if (!params.data?.name) return;
        const name = params.data.name;
        const members = points.filter((p) => {
          const parts = (p.ydFenqu || "").split("－");
          return parts[0] === name || parts[1] === name;
        });
        const broad = members[0]?.broad || "未分类";
        const sp: DialectPoint = {
          id: `__group__${name}`,
          name,
          title: name,
          lat: 0,
          lng: 0,
          region: name,
          group: name,
          subgroup: "",
          broad: broad as any,
          color: BROAD_COLORS[broad] || "#a0a0a0",
          symbol: "circle",
          ydFenqu: "",
          csFenqu: "",
          source: "",
          contributor: "",
          location: "",
          markerColor: BROAD_COLORS[broad] || "#a0a0a0",
          groupMembers: members.slice(0, 500),
        } as DialectPoint;
        selectDialect(sp);
      });

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(container);
      return () => {
        ro.disconnect();
        safeDispose(chart);
        chartRef.current = null;
      };
    } catch {
      safeDispose(chartRef.current);
      chartRef.current = null;
    }
  }, [mode, ydTree, points, selectDialect, theme]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {mode === "radial" ? (
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
      ) : (
        <div ref={treemapRef} style={{ width: "100%", height: "100%" }} />
      )}
      {mode === "treemap" && smallZones.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            background: "var(--glass-2)",
            padding: "6px 8px",
            borderRadius: "8px",
            fontSize: "11px",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            zIndex: 5,
            border: "0.5px solid var(--glass-border)",
            opacity: 0.9,
            maxWidth: "180px",
          }}
        >
          {smallZones.map((z: any) => (
            <div
              key={z.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 8px",
                borderRadius: 4,
                background: z.color,
                fontSize: 10,
                color: "#fff",
                fontWeight: 600,
                minWidth: 40,
                textAlign: "center",
              }}
            >
              {z.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
