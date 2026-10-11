/**
 * ToneCurveView.tsx — 声调曲线小多重图
 * Per-chart legend (bottom-right), per-chart dropdown (top-right)
 */
import { useMemo, useEffect, useRef, useCallback, useState } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { LegendList, MetricStrip, RailSection, ResearchLayout } from "@/components/ui/ResearchLayout";

interface ToneEntry { pitch: number[]; label: string; idx: number; }
interface PointTones { id: string; name: string; tones: ToneEntry[]; }
interface CatAgg { cat: string; count: number; tones: ToneEntry[]; color: string; points: PointTones[]; }

function parsePitch(raw: string): number[] {
  if (!raw || raw.trim() === "") return [];
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return [];
  const pts = digits.split("").map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 5);
  if (pts.length === 0) return [];
  if (pts.length === 1) return [pts[0], pts[0], pts[0]];
  if (pts.length === 2) return [pts[0], Math.round((pts[0] + pts[1]) / 2), pts[1]];
  return pts.slice(0, 3);
}

const TONE_COLORS = ["#c43a31", "#d4926a", "#4a7c59", "#3d6ba0", "#8e6b4f", "#e8b44a", "#6b3fa0", "#b0a080", "#6080a0", "#a040a0", "#40a040", "#c08060"];

const TONE_NAME: Record<number, string> = {
  1: "阴平", 2: "阳平", 3: "阴上", 4: "阳上", 5: "阴去", 6: "阳去", 7: "阴入", 8: "阳入",
};

function toneColor(idx: number): string {
  return TONE_COLORS[(idx - 1) % TONE_COLORS.length];
}

export function ToneCurveView() {
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const dk = theme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [pointSel, setPointSel] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    if (!dialects) return [] as CatAgg[];
    const map = new Map<string, {
      sumPitches: Map<number, number[][]>; total: number;
      points: { id: string; name: string; pitches: Map<number, number[]> }[];
    }>();

    for (const p of dialects.points) {
      const cat = p.broad || "未分类";
      if (!map.has(cat)) map.set(cat, { sumPitches: new Map(), total: 0, points: [] });
      const entry = map.get(cat)!;
      entry.total++;
      if (!p.toneSystem) continue;
      try {
        const ts = JSON.parse(p.toneSystem);
        const ptPitches = new Map<number, number[]>();
        for (const [k, v] of Object.entries(ts) as [string, any][]) {
          const idx = parseInt(k);
          if (isNaN(idx)) continue;
          const pitch = parsePitch(v[0]);
          if (pitch.length < 3) continue;
          if (!entry.sumPitches.has(idx)) entry.sumPitches.set(idx, []);
          entry.sumPitches.get(idx)!.push(pitch);
          ptPitches.set(idx, pitch);
        }
        if (ptPitches.size > 0) entry.points.push({ id: p.id, name: p.title || p.name || p.id, pitches: ptPitches });
      } catch { /* skip */ }
    }

    const result: CatAgg[] = [];
    for (const [cat, data] of map) {
      const tones: ToneEntry[] = [];
      const sortedKeys = Array.from(data.sumPitches.keys()).sort((a, b) => a - b);
      for (const idx of sortedKeys) {
        const pitches = data.sumPitches.get(idx)!;
        const avg = [0, 0, 0];
        for (const pp of pitches) { for (let i = 0; i < 3; i++) avg[i] += pp[i]; }
        for (let i = 0; i < 3; i++) avg[i] = Math.round((avg[i] / pitches.length) * 10) / 10;
        tones.push({ pitch: avg, label: TONE_NAME[idx] || `T${idx}`, idx });
      }
      const points: PointTones[] = data.points.map(pt => ({
        id: pt.id, name: pt.name,
        tones: Array.from(pt.pitches.entries()).sort(([a], [b]) => a - b).map(([idx, pitch]) => ({
          pitch, label: TONE_NAME[idx] || `T${idx}`, idx,
        })),
      })).filter(pt => pt.tones.length > 0);

      result.push({ cat, count: data.total, tones, color: BROAD_COLORS[cat] || "#a0a0a0", points });
    }
    return result.sort((a, b) => b.count - a.count);
  }, [dialects]);

  const displayCats = useMemo(() => {
    if (selectedCat) return categories.filter(c => c.cat === selectedCat);
    return categories.filter(c => c.points.length >= 2).slice(0, 15);
  }, [categories, selectedCat]);

  const renderChart = useCallback(() => {
    if (!containerRef.current || displayCats.length === 0) return;
    const el = containerRef.current;
    if (chartRef.current) { safeDispose(chartRef.current); chartRef.current = null; }
    const chart = echarts.init(el, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;

    const COLS = Math.min(displayCats.length, 4);
    const ROWS = Math.ceil(displayCats.length / COLS);

    const grids: any[] = [];
    const xAxes: any[] = [];
    const yAxes: any[] = [];
    const series: any[] = [];

    displayCats.forEach((cat, gi) => {
      const col = gi % COLS;
      const row = Math.floor(gi / COLS);
      const leftPct = col * (100 / COLS);
      const topPct = row * (100 / ROWS);

      const sel = pointSel[cat.cat] || "__avg__";
      const tones = sel === "__avg__"
        ? cat.tones
        : (cat.points.find(p => p.id === sel)?.tones || cat.tones);

      // Narrower, centered grid for more vertical breathing room
      const marginLR = (100 / COLS) * 0.18;
      const marginTB = (100 / ROWS) * 0.28;

      grids.push({
        left: `${leftPct + marginLR}%`,
        top: `${topPct + marginTB}%`,
        width: `${(100 / COLS) - marginLR * 2}%`,
        height: `${(100 / ROWS) - marginTB - (100 / ROWS) * 0.12}%`,
        containLabel: false,
      });

      xAxes.push({
        gridIndex: gi, type: "category", data: ["", "", ""],
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false }, splitLine: { show: false },
        boundaryGap: false,
      });

      yAxes.push({
        gridIndex: gi, type: "value", min: 0.5, max: 5.5,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: true, fontSize: 8, color: dk ? "#888" : "#aaa", margin: 2 },
        splitLine: { show: true, lineStyle: { color: dk ? "#444" : "#e0e0e0", type: "dashed", width: 0.5 } },
      });

      tones.forEach((t: ToneEntry, ti: number) => {
        series.push({
          type: "line", xAxisIndex: gi, yAxisIndex: gi,
          data: t.pitch,
          smooth: 0.2,
          symbol: "circle", symbolSize: 3,
          lineStyle: { width: 1.6, color: toneColor(t.idx) },
          itemStyle: { color: toneColor(t.idx) },
        });
      });
    });

    chart.setOption({
      backgroundColor: "transparent",
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    }, true);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); safeDispose(chart); chartRef.current = null; };
  }, [displayCats, pointSel, dk]);

  useEffect(() => {
    const cleanup = renderChart();
    return () => { cleanup?.(); };
  }, [renderChart]);

  if (!dialects) {
    return (<div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载数据..." : "載入資料..."}</span></div>);
  }

  // Collect all unique tone indices from visible charts for legend
  const visibleToneIndices = useMemo(() => {
    const set = new Set<number>();
    for (const cat of displayCats) {
      const sel = pointSel[cat.cat] || "__avg__";
      const tones = sel === "__avg__" ? cat.tones : (cat.points.find(p => p.id === sel)?.tones || []);
      for (const t of tones) set.add(t.idx);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [displayCats, pointSel]);

  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "比较范围" : "比較範圍"}>
        <select
          value={selectedCat || ""}
          onChange={(e) => setSelectedCat(e.target.value || null)}
          style={{
            padding: "4px 8px", borderRadius: 6, fontSize: 12,
            border: "0.5px solid var(--border)", background: "var(--bg-overlay)",
            color: "var(--text)", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <option value="">{lang === "zh-CN" ? "全部大类" : "全部大類"}</option>
          {categories.map(c => (
            <option key={c.cat} value={c.cat}>{c.cat} ({c.count})</option>
          ))}
        </select>
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "可见调类" : "可見調類"}>
        <LegendList
          items={visibleToneIndices.map((idx) => ({
            key: String(idx),
            label: TONE_NAME[idx] || `T${idx}`,
            color: toneColor(idx),
          }))}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "调型读法" : "調型讀法"}>
        <LegendList
          items={[
            { key: "55", label: "55", value: lang === "zh-CN" ? "高平" : "高平", color: "var(--accent)" },
            { key: "35", label: "35", value: lang === "zh-CN" ? "升调" : "升調", color: "var(--mineral-green)" },
            { key: "51", label: "51", value: lang === "zh-CN" ? "降调" : "降調", color: "var(--mineral-red)" },
            { key: "214", label: "214", value: lang === "zh-CN" ? "曲折" : "曲折", color: "var(--mineral-blue)" },
          ]}
        />
        <p style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: "var(--text-tertiary)" }}>
          {lang === "zh-CN" ? "纵轴统一为五度制音高，便于跨大类比较轮廓。" : "縱軸統一為五度制音高，便於跨大類比較輪廓。"}
        </p>
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "样本" : "樣本"}>
        <MetricStrip
          items={[
            { label: lang === "zh-CN" ? "显示大类" : "顯示大類", value: displayCats.length, tone: "accent" },
            { label: lang === "zh-CN" ? "候选大类" : "候選大類", value: categories.length },
          ]}
        />
      </RailSection>
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Tone" railTitle={lang === "zh-CN" ? "五度调型" : "五度調型"}>
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {displayCats.map((cat, i) => {
          const COLS = Math.min(displayCats.length, 4);
          const ROWS = Math.ceil(displayCats.length / COLS);
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const leftPct = col * (100 / COLS);
          const topPct = row * (100 / ROWS);
          const wPct = 100 / COLS;
          const hPct = 100 / ROWS;
          const sel = pointSel[cat.cat] || "__avg__";
          const currentTones = sel === "__avg__" ? cat.tones : (cat.points.find(p => p.id === sel)?.tones || cat.tones);

          return (
            <div key={cat.cat} style={{
              position: "absolute",
              left: `${leftPct}%`, top: `${topPct}%`,
              width: `${wPct}%`, height: `${hPct}%`,
              pointerEvents: "auto",
            }}>
              {/* Title top-left */}
              <span style={{
                position: "absolute", left: 8, top: 4,
                fontSize: 12, fontWeight: 600, color: "var(--text)",
                fontFamily: "var(--font-serif)", lineHeight: 1.2,
              }}>
                {cat.cat}
              </span>
              <span style={{
                position: "absolute", left: 8, top: 20,
                fontSize: 10, color: "var(--text-tertiary)",
              }}>
                {cat.count} 点
              </span>
              {/* Dropdown top-right */}
              {cat.points.length > 0 && (
                <select
                  value={sel}
                  onChange={(e) => setPointSel(prev => ({ ...prev, [cat.cat]: e.target.value }))}
                  style={{
                    position: "absolute", right: 6, top: 4,
                    padding: "2px 4px", borderRadius: 4, fontSize: 10,
                    border: "0.5px solid var(--border-subtle)",
                    background: "var(--bg-overlay)", color: "var(--text-secondary)",
                    cursor: "pointer", fontFamily: "inherit", maxWidth: 80,
                  }}
                >
                  <option value="__avg__">{lang === "zh-CN" ? "平均" : "平均"}</option>
                  {cat.points.map(p => (
                    <option key={p.id} value={p.id}>{p.name.length > 4 ? p.name.slice(0, 4) + "…" : p.name}</option>
                  ))}
                </select>
              )}
              {/* Per-chart legend bottom-right */}
              <div style={{
                position: "absolute", right: 6, bottom: 4,
                display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end",
                fontSize: 9, color: "var(--text-tertiary)",
              }}>
                {currentTones.map(t => (
                  <span key={t.idx} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ width: 8, height: 2.5, background: toneColor(t.idx), borderRadius: 1 }} />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ResearchLayout>
  );
}
