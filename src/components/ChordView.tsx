import { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { BROAD_CATEGORIES } from "@/types";
import { useInsights } from "@/hooks/useInsights";
import { LegendList, MetricStrip, RailSection, ResearchLayout } from "@/components/ui/ResearchLayout";

const CATS = BROAD_CATEGORIES.filter((c) => c !== "未分类");

export function ChordView() {
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const insights = useInsights();
  const [drData, setDrData] = useState<any>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dk = theme === "dark";

  useEffect(() => {
    fetch("/data/dialect_readings.json")
      .then((r) => r.json())
      .then((d) => setDrData(d))
      .catch(() => {});
  }, []);

  // Build pointId → broad map
  const pointToBroad = useMemo(() => {
    const map = new Map<string, string>();
    if (dialects?.points) {
      for (const p of dialects.points) {
        if (p.id) map.set(p.id, p.broad);
        if (p.name) map.set(p.name, p.broad);
        if (p.title) map.set(p.title, p.broad);
      }
    }
    return map;
  }, [dialects]);

  // Build sharing matrix
  const { matrix, groups } = useMemo(() => {
    if (!drData?.charIndex) return { matrix: [] as number[][], groups: CATS };

    const catSet = new Set<string>();
    const charCats = new Map<string, Set<string>>();

    for (const [ch, readings] of Object.entries(drData.charIndex) as [string, any[]][]) {
      const broads = new Set<string>();
      for (const r of readings) {
        const broad = pointToBroad.get(r.pointId) || pointToBroad.get(r.pointName) || "";
        if (broad && (CATS as readonly string[]).includes(broad)) broads.add(broad);
      }
      if (broads.size >= 2) {
        charCats.set(ch, broads);
        broads.forEach((b) => catSet.add(b));
      }
    }

    const ordered = CATS.filter((c) => catSet.has(c)) as string[];
    const n = ordered.length;
    const mat: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (const broads of charCats.values()) {
      const list = Array.from(broads);
      for (let i = 0; i < list.length; i++) {
        const ai = ordered.indexOf(list[i]);
        if (ai < 0) continue;
        for (let j = i + 1; j < list.length; j++) {
          const aj = ordered.indexOf(list[j]);
          if (aj < 0) continue;
          mat[ai][aj]++;
          mat[aj][ai]++;
        }
      }
    }

    return { matrix: mat, groups: ordered };
  }, [drData, pointToBroad]);

  useEffect(() => {
    if (!matrix.length || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 600;
    const innerRadius = 120;
    const outerRadius = Math.min(width, height) * 0.5 - 40;

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);

    const color = d3.scaleOrdinal<string>().domain(groups).range(groups.map((g) => BROAD_COLORS[g] || "#a0a0a0"));

    const arc = d3.arc<d3.ChordGroup>().innerRadius(innerRadius).outerRadius(outerRadius);

    const ribbon = d3.ribbon<d3.Chord, d3.ChordGroup>().radius(innerRadius);

    // Groups (outer arcs)
    g.append("g")
      .selectAll("path")
      .data(chord.groups)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d) => color(groups[d.index]))
      .attr("stroke", dk ? "#111620" : "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this).attr("opacity", 0.8);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 1);
      })
      .on("click", (_e, d) => {
        const broad = groups[d.index];
        const members = dialects?.points?.filter((p) => p.broad === broad) || [];
        if (members.length) {
          selectDialect({
            id: `__chord__${broad}`,
            name: broad, title: broad,
            lat: 0, lng: 0, region: "", group: "", subgroup: "",
            broad: broad as any, color: "", symbol: "",
            ydFenqu: "", csFenqu: "", source: "", contributor: "",
            location: "", markerColor: "",
            groupMembers: members.slice(0, 500),
          } as any);
        }
      });

    // Group labels — standard rotate + translate + flip approach
    g.append("g")
      .selectAll("text")
      .data(chord.groups)
      .join("text")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("fill", dk ? "#e8e4df" : "#1a1814")
      .attr("transform", (d) => {
        const mid = (d.startAngle + d.endAngle) / 2;
        const angle = mid * 180 / Math.PI - 90;
        const flip = mid > Math.PI;
        return `rotate(${angle}) translate(${outerRadius + 14}) ${flip ? "rotate(180)" : ""}`;
      })
      .attr("text-anchor", (d) => ((d.startAngle + d.endAngle) / 2 > Math.PI ? "end" : "start"))
      .attr("dy", "0.35em")
      .text((d) => groups[d.index]);

    // Ribbons
    g.append("g")
      .selectAll("path")
      .data(chord)
      .join("path")
      .attr("d", ribbon as any)
      .attr("fill", (d) => color(groups[d.source.index]))
      .attr("fill-opacity", 0.28)
      .attr("stroke", dk ? "#111620" : "#fff")
      .attr("stroke-width", 0.5)
      .append("title")
      .text((d) => `${groups[d.source.index]} ↔ ${groups[d.target.index]}: ${d.source.value} 字`);
  }, [matrix, groups, dk, dialects, selectDialect]);

  if (!drData) {
    return (<div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载方言读音..." : "載入方言讀音..."}</span></div>);
  }

  const sharedPairs = Math.round(matrix.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0) / 2);
  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "关系规模" : "關係規模"}>
        <MetricStrip
          items={[
            { label: lang === "zh-CN" ? "大类" : "大類", value: matrix.length, tone: "accent" },
            { label: lang === "zh-CN" ? "共享字对" : "共享字對", value: sharedPairs },
          ]}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "方言大类" : "方言大類"}>
        <LegendList
          items={groups.map((group) => ({
            key: group,
            label: group,
            color: BROAD_COLORS[group] || "#a0a0a0",
          }))}
        />
      </RailSection>
      {insights?.chordStats?.topPairs?.length ? (
        <RailSection title={lang === "zh-CN" ? "共享字关系排名" : "共享字關係排名"}>
          <LegendList
            items={insights.chordStats.topPairs.slice(0, 8).map((pair) => ({
              key: `${pair.source}-${pair.target}`,
              label: `${pair.source} ↔ ${pair.target}`,
              value: pair.value,
              color: BROAD_COLORS[pair.source] || "var(--accent)",
            }))}
          />
          <p style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: "var(--text-tertiary)" }}>
            {lang === "zh-CN" ? "排名表示共同收录覆盖，不直接等同语音相似度。" : "排名表示共同收錄覆蓋，不直接等同語音相似度。"}
          </p>
        </RailSection>
      ) : null}
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Relation" railTitle={lang === "zh-CN" ? "共享文字关系" : "共享文字關係"}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%", maxWidth: 600, maxHeight: 600 }} />
      </div>
    </ResearchLayout>
  );
}
