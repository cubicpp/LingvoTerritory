/**
 * DialectCharView.tsx — 特征文字：语料词云 + 频次图 + 累积覆盖
 * Multi-dialect: loads freq TSV per dialect
 */
import { useMemo, useEffect, useRef, useCallback, useState } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { useInsights } from "@/hooks/useInsights";
import { LegendList, MetricStrip, RailSection, ResearchLayout } from "@/components/ui/ResearchLayout";

interface CharFreq { char: string; freq: number; }

const DIALECTS: { id: string; label: string; tsv: string; png: string }[] = [
  { id: "yue", label: "粤语", tsv: "/data/yue_char_freq.tsv", png: "/wordclouds/粤语.png" },
  { id: "min", label: "闽语", tsv: "/data/minnan_freq.tsv", png: "/wordclouds/闽语.png" },
  { id: "wu", label: "吴语", tsv: "/data/wu_freq.tsv", png: "/wordclouds/吴语.png" },
  { id: "chuan", label: "官话（四川话）", tsv: "/data/chuan_freq.tsv", png: "/wordclouds/官话.png" },
  { id: "hakka", label: "客家话", tsv: "/data/hakka_freq.tsv", png: "/wordclouds/客家话.png" },
];

export function DialectCharView() {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const dk = theme === "dark";
  const [dialect, setDialect] = useState(DIALECTS[0]);
  const [rawData, setRawData] = useState<CharFreq[] | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const insights = useInsights();
  const barRef = useRef<HTMLDivElement>(null);
  const barChart = useRef<echarts.ECharts | null>(null);
  const paretoRef = useRef<HTMLDivElement>(null);
  const paretoChart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    setRawData(null);
    setImgFailed(false);
    fetch(dialect.tsv)
      .then((r) => r.text())
      .then((t) => {
        const rows: CharFreq[] = [];
        for (const line of t.split("\n")) {
          const [c, f] = line.split("\t");
          if (c && f) rows.push({ char: c, freq: parseInt(f) });
        }
        rows.sort((a, b) => b.freq - a.freq);
        setRawData(rows);
      })
      .catch(() => setRawData([]));
  }, [dialect]);

  const top50 = useMemo(() => (rawData || []).slice(0, 50), [rawData]);
  const corpusInsight = insights?.charDistinctiveness?.[dialect.id];

  // Normalize top50 for better visual differentiation
  const barData = useMemo(() => {
    if (top50.length === 0) return { labels: [] as string[], values: [] as number[] };
    const labels = top50.map((r) => r.char).reverse();
    const values = top50.map((r) => r.freq).reverse();
    return { labels, values };
  }, [top50]);

  // Pareto cumulative coverage
  const paretoData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [] as [number, number][];
    const total = rawData.reduce((s, r) => s + r.freq, 0);
    let sum = 0;
    const pts: [number, number][] = [];
    // Sample ~100 points + key milestones
    const milestones = new Set([1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3000]);
    for (let i = 0; i < rawData.length; i++) {
      sum += rawData[i].freq;
      const rank = i + 1;
      if (rank <= 100 || rank % Math.ceil(rawData.length / 80) === 0 || milestones.has(rank)) {
        pts.push([rank, Math.round((sum / total) * 1000) / 10]);
      }
    }
    // Ensure last point
    const last = rawData.length;
    if (!pts.some((p) => p[0] === last)) {
      pts.push([last, 100]);
    }
    return pts;
  }, [rawData]);

  // Pareto chart
  const renderPareto = useCallback(() => {
    if (!paretoRef.current || paretoData.length === 0) return;
    if (paretoChart.current) { safeDispose(paretoChart.current); }
    paretoChart.current = echarts.init(paretoRef.current, theme === "dark" ? "dark" : undefined);
    const c = paretoChart.current;

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: dk ? "#181d28" : "#fff",
        borderColor: dk ? "#282d38" : "#e5e0d5",
        textStyle: { color: dk ? "#e8e4df" : "#1a1814", fontSize: 12 },
        formatter: (p: any) => `前 ${p[0]?.data[0]} 字覆盖 <b>${p[0]?.data[1]}%</b>`,
      },
      grid: { left: 40, right: 12, top: 8, bottom: 20 },
      xAxis: {
        type: "value", name: "", nameLocation: "middle", nameGap: 14,
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: dk ? "#444" : "#e0e0e0", type: "dashed" } },
        axisLabel: { show: false },
        min: 0,
        max: paretoData.length > 0 ? paretoData[paretoData.length - 1][0] : undefined,
      },
      yAxis: {
        type: "value", name: "", nameTextStyle: { fontSize: 10, color: dk ? "#888" : "#aaa" },
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: dk ? "#444" : "#e0e0e0", type: "dashed" } },
        axisLabel: { show: false },
        max: 100,
      },
      series: [{
        type: "line", data: paretoData, smooth: 0.3,
        symbol: "none", lineStyle: { width: 2, color: "#c43a31" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(196,58,49,0.25)" }, { offset: 1, color: "rgba(196,58,49,0.02)" },
        ])},
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(paretoRef.current);
    return () => { ro.disconnect(); safeDispose(c); paretoChart.current = null; };
  }, [paretoData, dk]);

  useEffect(() => { const cl = renderPareto(); return () => { cl?.(); }; }, [renderPareto]);

  // Bar chart
  const renderBar = useCallback(() => {
    if (!barRef.current || barData.labels.length === 0) return;
    if (barChart.current) { safeDispose(barChart.current); }
    barChart.current = echarts.init(barRef.current, theme === "dark" ? "dark" : undefined);
    const c = barChart.current;

    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: dk ? "#181d28" : "#fff",
        borderColor: dk ? "#282d38" : "#e5e0d5",
        textStyle: { color: dk ? "#e8e4df" : "#1a1814", fontSize: 12 },
        formatter: (p: any) => {
          const row = top50.find((r) => r.char === p[0]?.name);
          const total = rawData?.reduce((s, r) => s + r.freq, 0) || 1;
          const pct = row ? Math.round((row.freq / total) * 10000) / 100 : 0;
          return `${p[0]?.name}: <b>${row?.freq ?? ""}</b><br/>占比: ${pct}%`;
        },
      },
      grid: { left: 28, right: 12, top: 4, bottom: 8 },
      xAxis: {
        type: "value", min: 0,
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "category", data: barData.labels, inverse: true,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 12, color: dk ? "#ccc" : "#333", fontFamily: "var(--font-serif)", margin: 2, interval: 0 },
      },
      series: [{
        type: "bar",
        data: barData.values.map((v) => ({
          value: v,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#d4926a" }, { offset: 1, color: "#c43a31" },
            ]),
            borderRadius: [0, 3, 3, 0],
          },
        })),
        barWidth: 12,
        emphasis: { itemStyle: { color: "#c43a31" } },
      }],
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(barRef.current);
    return () => { ro.disconnect(); safeDispose(c); barChart.current = null; };
  }, [barData, dk, top50]);

  useEffect(() => {
    const cleanup = renderBar();
    return () => { cleanup?.(); };
  }, [renderBar]);

  const totalFreq = rawData?.reduce((sum, row) => sum + row.freq, 0) ?? 0;
  const rail = (
    <>
      <RailSection title={lang === "zh-CN" ? "语料" : "語料"}>
        <select
          value={dialect.id}
          onChange={(e) => {
            const d = DIALECTS.find((dd) => dd.id === e.target.value);
            if (d) setDialect(d);
          }}
          style={{
            padding: "6px 12px", fontSize: 14, borderRadius: 8,
            border: "0.5px solid var(--border)", background: "var(--bg-overlay)",
            color: "var(--text)", fontFamily: "var(--font-serif)",
            cursor: "pointer", outline: "none",
          }}
        >
          {DIALECTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "规模" : "規模"}>
        <MetricStrip
          items={[
            { label: lang === "zh-CN" ? "字种" : "字種", value: rawData?.length ?? "—", tone: "accent" },
            { label: lang === "zh-CN" ? "字次" : "字次", value: totalFreq || "—" },
          ]}
        />
      </RailSection>
      <RailSection title={lang === "zh-CN" ? "区分度字" : "區分度字"}>
        <LegendList
          items={(corpusInsight?.topDistinctive ?? []).slice(0, 12).map((item, index) => ({
            key: `${item.char}-${index}`,
            label: item.char,
            value: item.distinctiveness,
            color: index < 5 ? "var(--accent)" : "var(--mineral-green)",
          }))}
        />
      </RailSection>
    </>
  );

  return (
    <ResearchLayout rail={rail} railKicker="Corpus" railTitle={lang === "zh-CN" ? "特征文字" : "特徵文字"}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Word cloud */}
        <div style={{
          width: "55%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg)", borderRight: "0.5px solid var(--border-subtle)",
        }}>
          {!imgFailed ? (
            <img
              key={dialect.id}
              src={dialect.png}
              alt={`${dialect.label}词云`}
              onError={() => setImgFailed(true)}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{lang === "zh-CN" ? "词云加载失败" : "詞雲載入失敗"}</div>
          )}
        </div>

        {/* Right column: Pareto + Bar */}
        <div style={{ width: "45%", display: "flex", flexDirection: "column" }}>
          {/* Cumulative coverage */}
          <div style={{
            padding: "6px 12px", fontSize: 11, color: "var(--text-tertiary)",
            borderBottom: "0.5px solid var(--border-subtle)", flexShrink: 0,
          }}>
            累积覆盖曲线
          </div>
          <div ref={paretoRef} style={{ height: "22%", flexShrink: 0 }} />

          <div style={{
            padding: "6px 12px", fontSize: 11, color: "var(--text-tertiary)",
            borderTop: "0.5px solid var(--border-subtle)", borderBottom: "0.5px solid var(--border-subtle)",
            flexShrink: 0,
          }}>
            {lang === "zh-CN" ? "TOP 50 真实频次" : "TOP 50 真實頻次"}
          </div>
          <div ref={barRef} style={{ flex: 1 }} />
        </div>
      </div>
    </ResearchLayout>
  );
}
