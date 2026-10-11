/**
 * CharQueryView.tsx — 汉字查询（v6.0: merged with DictCompareView — tab switching）
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as echarts from "echarts";
import { useAppStore } from "@/store/useAppStore";
import { safeDispose } from "@/lib/safeDispose";
import { initDictDb, getExtraReadings, getCoreReadings, getJapaneseReadings } from "@/lib/sqlite";
import type { DialectPoint } from "@/types";

const LANG_ORDER = ["pu", "ct", "vn", "kr", "jp_on", "jp_kun", "def"];
const LANG_NAME: Record<string, string> = {
  pu: "普通话", ct: "粤语", vn: "越南语", kr: "朝鲜语",
  jp_on: "日语(音)", jp_kun: "日语(训)", def: "释义",
};

interface UnifiedReading {
  key: string;
  label: string;
  reading: string;
  section: "lang" | "mc" | "jp" | "region" | "def";
}

interface DialectReading {
  pointId: string;
  reading: string;
  pointName: string;
  comment?: string;
}

interface DialectReadingsData {
  charIndex: Record<string, DialectReading[]>;
}

interface DictEntry {
  fanqie?: string;
  reading?: string;
  def?: string;
  d?: string;
  r?: string;
  p?: string;
}

const DICT_INFO = [
  { key: "shuowen", label: "说文解字", desc: "东汉·许慎 (121 CE)", color: "#8B4513" },
  { key: "kangxi", label: "康熙字典", desc: "清·张玉书等 (1716)", color: "#2E4053" },
  { key: "handa", label: "汉语大字典", desc: "徐中舒主编 (1986-1990)", color: "#6B3FA0" },
  { key: "huizuan", label: "古音汇纂", desc: "汇集历代音切", color: "#B8860B" },
  { key: "moe", label: "萌典", desc: "中國台灣省「教育部」國語辭典", descZh: "中国台湾省\"教育部\"国语辞典", descTw: "中國台灣省「教育部」國語辭典", color: "#2E7D32" },
];

const bundleCache: Record<string, Record<string, { p: string; r: string; c?: string }[]>> = {};

const xxBundleCache: Record<string, Record<string, Record<string, { char: string; initial: string; final: string; tone_value: string; tone_category: string; note: string }[]>>> = {};
let xxOverlap: Record<string, { group: string }> | null = null;
fetch("/data/xx_overlap.json").then(r => r.json()).then(d => { xxOverlap = d; }).catch(() => {});

export function CharQueryView() {
  const charReadings = useAppStore((s) => s.dataCache.charReadings);
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const china = useAppStore((s) => s.dataCache.china);
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const setSubMode = useAppStore((s) => s.setSubMode);
  const [query, setQuery] = useState("東");
  const [mode, setMode] = useState<"query" | "dict">("query");
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [dialectReadings, setDialectReadings] = useState<DialectReadingsData | null>(null);
  const [fullDialectReadings, setFullDialectReadings] = useState<DialectReading[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);

  const dk = theme === "dark";
  const [variantMap, setVariantMap] = useState<Record<string, string[]> | null>(null);
  const [shuowenData, setShuowenData] = useState<Record<string, any> | null>(null);
  const [kangxiData, setKangxiData] = useState<Record<string, any> | null>(null);
  const [handaData, setHandaData] = useState<Record<string, any[]> | null>(null);
  const [huizuanData, setHuizuanData] = useState<Record<string, any[]> | null>(null);
  const [extraReadings, setExtraReadings] = useState<{ label: string; reading: string }[]>([]);
  const [jpReadings, setJpReadings] = useState<{ label: string; reading: string }[]>([]);
  const [coreReadings, setCoreReadings] = useState<{ label: string; reading: string }[]>([]);
  const [moeData, setMoeData] = useState<Record<string, any[]> | null>(null);
  const [zhengziMap, setZhengziMap] = useState<Record<string, string[]> | null>(null);
  const [unihanExtra, setUnihanExtra] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch("/data/variant_map.json").then(r => r.json()).then(setVariantMap).catch(() => {});
    fetch("/data/shuowen.json").then(r => r.json()).then(setShuowenData).catch(() => {});
    fetch("/data/kangxi.json").then(r => r.json()).then(setKangxiData).catch(() => {});
    fetch("/data/handa.json").then(r => r.json()).then(setHandaData).catch(() => {});
    fetch("/data/huizuan.json").then(r => r.json()).then(setHuizuanData).catch(() => {});
    fetch("/data/moe_dict.json").then(r => r.json()).then(setMoeData).catch(() => {});
    fetch("/data/zhengzi_map.json").then(r => r.json()).then(setZhengziMap).catch(() => {});
    fetch("/data/unihan_extra.json").then(r => r.json()).then(setUnihanExtra).catch(() => {});
    initDictDb().catch(() => {});
  }, []);

  const effectiveQuery = query;
  const variantChars = useMemo(() => {
    if (!variantMap || !query) return [];
    return variantMap[query] || [];
  }, [variantMap, query]);

  const handleCompositionStart = () => { setComposing(true); };
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setComposing(false);
    setQuery((e.data || e.currentTarget.value).slice(0, 1));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(composing ? e.target.value : e.target.value.slice(0, 1));
  };
  const handleBlur = () => {
    if (composing) {
      setComposing(false);
      setQuery((q) => q.slice(0, 1));
    }
  };

  useEffect(() => {
    fetch("/data/dialect_readings.json")
      .then((r) => r.json())
      .then((data) => setDialectReadings(data))
      .catch(() => {});
  }, []);

  // Lazy-load full per-dialect readings for the queried character
  useEffect(() => {
    if (!query) return;
    const code = query.codePointAt(0)?.toString(16).toUpperCase();
    if (!code) return;
    const cp = parseInt(code, 16);
    const bundleStart = Math.floor(cp / 256) * 256;
    const bundleKey = bundleStart.toString(16).toUpperCase().padStart(5, "0");
    const bundleUrl = `/data/char_bundles/${bundleKey}.json`;
    const process = (data: { p: string; r: string; c?: string }[]) => {
      const pts = useAppStore.getState().dataCache.dialects?.points;
      const ptMap = new Map(pts?.map(p => [p.id, p]) || []);
      setFullDialectReadings(data.map(d => ({
        pointId: d.p,
        reading: d.r,
        pointName: ptMap.get(d.p)?.name || d.p,
        comment: d.c,
      })));
    };
    if (bundleCache[bundleKey]) {
      process(bundleCache[bundleKey][code] || []);
    } else {
      fetch(bundleUrl)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then((bundle: Record<string, { p: string; r: string; c?: string }[]>) => {
          bundleCache[bundleKey] = bundle;
          process(bundle[code] || []);
        })
        .catch(() => setFullDialectReadings([]));
    }
  }, [query]);

  // ── Xiaoxuetang readings ──
  const [xxReadings, setXxReadings] = useState<Record<string, { initial: string; final: string; tone_value: string; tone_category: string; note: string }[]>>({});
  useEffect(() => {
    if (!query) return;
    const code = query.codePointAt(0)?.toString(16).toUpperCase().padStart(5, "0");
    if (!code) return;
    const cp = parseInt(code, 16);
    const bundleStart = Math.floor(cp / 256) * 256;
    const bundleKey = bundleStart.toString(16).toUpperCase().padStart(5, "0");
    const bundleUrl = `/data/xx_bundles/${bundleKey}.json`;

    if (xxBundleCache[bundleKey]) {
      setXxReadings(xxBundleCache[bundleKey][code] || {});
    } else {
      fetch(bundleUrl)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then((bundle: Record<string, Record<string, any[]>>) => {
          xxBundleCache[bundleKey] = bundle;
          setXxReadings(bundle[code] || {});
        })
        .catch(() => setXxReadings({}));
    }
  }, [query]);

  const readingPointIds = new Set<string>();
  const readingDetails: DialectReading[] = [];
  // Merge full dialect readings (from 2,700+ points) with existing ones
  const allReadings = [...fullDialectReadings];
  if (dialectReadings && query) {
    const lookupChars = [query, ...(variantMap?.[query] || [])];
    const seenPids = new Set(allReadings.map(r => r.pointId));
    for (const ch of lookupChars) {
      const items = dialectReadings.charIndex[ch];
      if (items) {
        for (const item of items) {
          if (!seenPids.has(item.pointId)) {
            seenPids.add(item.pointId);
            allReadings.push(item);
          }
        }
      }
    }
  }
  for (const r of allReadings) {
    if (!readingPointIds.has(r.pointId)) {
      readingPointIds.add(r.pointId);
      readingDetails.push(r);
    }
  }
  const displayDetails = readingDetails.slice(0, 100);

  // ── Language readings ──
  useEffect(() => {
    if (!charReadings || !query) return;
    const langIndex = charReadings.langIndex;
    const result: Record<string, string> = {};
    const lookupChars = [query, ...(variantMap?.[query] || [])];
    for (const lang of LANG_ORDER) {
      for (const ch of lookupChars) {
        if (langIndex[lang]?.[ch]) { result[lang] = langIndex[lang][ch]; break; }
      }
    }
    // 正字 normalization: if no langIndex results, try standard character
    if (Object.keys(result).length === 0 && zhengziMap) {
      const stdChars = zhengziMap[query];
      if (stdChars) {
        for (const sc of stdChars) {
          for (const lang of LANG_ORDER) {
            if (langIndex[lang]?.[sc] && !result[lang]) { result[lang] = langIndex[lang][sc]; }
          }
        }
      }
    }
    setReadings(result);
    setExtraReadings(getExtraReadings(query));
    setJpReadings(getJapaneseReadings(query));
    setCoreReadings(getCoreReadings(query));
  }, [query, charReadings, variantMap, zhengziMap]);

  // ── ECharts map: use pre-loaded china from App.tsx dataCache ──
  useEffect(() => {
    if (!mapRef.current || !dialects || !china) return;
    safeDispose(chartRef.current);

    const chart = echarts.init(mapRef.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;

    echarts.registerMap("china", china as any);
    renderMap(chart, dialects.points);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(mapRef.current);
    return () => { ro.disconnect(); safeDispose(chart); };
  }, [dialects, china, theme]);

  // ── Update highlights ──
  useEffect(() => {
    if (chartRef.current && dialects) {
      renderMap(chartRef.current, dialects.points);
    }
  }, [readingPointIds.size]);

  // ── renderMap: called by both effects above, reads readingPointIds from closure ──
  function renderMap(chart: echarts.ECharts, points: DialectPoint[]) {
    const withData: [number, number, string, string][] = [];
    const withoutData: [number, number, string, string][] = [];
    for (const p of points) {
      const entry: [number, number, string, string] = [p.lng, p.lat, p.id, p.name];
      if (readingPointIds.has(p.id)) withData.push(entry);
      else withoutData.push(entry);
    }

    const series: echarts.SeriesOption[] = [];
    if (withoutData.length > 0) {
      series.push({
        type: "scatter", coordinateSystem: "geo",
        data: withoutData.map(([lng, lat, id, name]) => ({ name, value: [lng, lat, id] })),
        symbolSize: 2, itemStyle: { color: "#b0b0b0", opacity: 0.2 }, silent: true,
      });
    }
    if (withData.length > 0) {
      series.push({
        type: "scatter", coordinateSystem: "geo",
        data: withData.map(([lng, lat, id, name]) => ({ name, value: [lng, lat, id] })),
        symbolSize: 5, itemStyle: { color: "#c43a31", opacity: 0.9 },
        emphasis: { itemStyle: { opacity: 1 }, scale: 2.5 },
      });
    }

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const d = points.find((x) => x.id === p.data?.value?.[2]);
          if (!d) return p.name || "";
          return `<b>${d.name}</b><br/>${d.location || ""}<br/>${d.broad} · ${d.region}${readingPointIds.has(d.id) ? "<br/><span style='color:#c43a31'>有记录</span>" : ""}`;
        },
      },
      geo: {
        map: "china", roam: true, zoom: 1.2, center: [108, 35], scaleLimit: { min: 0.8, max: 8 },
        itemStyle: { areaColor: dk ? "#151b26" : "#f2f0eb", borderColor: dk ? "#282d38" : "#d6d3d1", borderWidth: 0.5 },
        emphasis: { disabled: true },
      },
      series,
    }, true);

    chart.off("click");
    chart.on("click", (params: any) => {
      const id = params.data?.value?.[2];
      if (id) { const d = points.find((x) => x.id === id); if (d) selectDialect(d); }
    });
  }

  const renderDictEntry = (key: string) => {
    switch (key) {
      case "shuowen": {
        const e = shuowenData?.[effectiveQuery];
        if (!e) return <div style={{ color: "var(--text-tertiary)", fontSize: 12, textAlign: "center", padding: 16 }}>{lang === "zh-CN" ? "未收录此字" : "未收錄此字"}</div>;
        return (
          <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
            {e.fanqie && <div style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: "var(--text)" }}>{lang === "zh-CN" ? "反切：" : "反切："}</span>{e.fanqie}</div>}
            {e.reading && <div style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: "var(--text)" }}>{lang === "zh-CN" ? "今读：" : "今讀："}</span>{e.reading}</div>}
            <div style={{ whiteSpace: "pre-wrap" }}>{e.def}</div>
          </div>
        );
      }
      case "kangxi": {
        const e = kangxiData?.[effectiveQuery];
        if (!e) return <div style={{ color: "var(--text-tertiary)", fontSize: 12, textAlign: "center", padding: 16 }}>{lang === "zh-CN" ? "未收录此字" : "未收錄此字"}</div>;
        return (
          <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
            {e.fanqie && <div style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: "var(--text)" }}>{lang === "zh-CN" ? "反切：" : "反切："}</span>{e.fanqie}</div>}
            <div style={{ whiteSpace: "pre-wrap" }}>{e.def}</div>
          </div>
        );
      }
      case "handa": {
        const entries = handaData?.[effectiveQuery];
        if (!entries || entries.length === 0) return <div style={{ color: "var(--text-tertiary)", fontSize: 12, textAlign: "center", padding: 16 }}>{lang === "zh-CN" ? "未收录此字" : "未收錄此字"}</div>;
        return (
        // handa
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.slice(0, 8).map((e, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>
                <div style={{ marginBottom: 2 }}>
                  {e.p && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginRight: 6 }}>p.{e.p}</span>}
                  {e.r && <span style={{ color: "var(--accent)", fontWeight: 600 }}>[{e.r}]</span>}
                </div>
                <div>{e.d?.slice(0, 300)}</div>
              </div>
            ))}
          </div>
        );
      }
      case "huizuan": {
        const entries = huizuanData?.[effectiveQuery];
        if (!entries || entries.length === 0) return <div style={{ color: "var(--text-tertiary)", fontSize: 12, textAlign: "center", padding: 16 }}>{lang === "zh-CN" ? "未收录此字" : "未收錄此字"}</div>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.slice(0, 6).map((e, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", paddingLeft: 8, borderLeft: "2px solid #B8860B" }}>
                {e.p && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginRight: 6 }}>p.{e.p}</span>}
                {e.r && <span style={{ color: "var(--accent)", fontWeight: 600 }}>[{e.r}]</span>}
                <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{e.d?.slice(0, 400)}</div>
              </div>
            ))}
          </div>
        );
      }
      case "moe": {
        const entries = moeData?.[effectiveQuery];
        if (!entries || entries.length === 0) return <div style={{ color: "var(--text-tertiary)", fontSize: 12, textAlign: "center", padding: 16 }}>{lang === "zh-CN" ? "未收录此字" : "未收錄此字"}</div>;
        // moe
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.slice(0, 5).map((e: any, i: number) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                    {e.z && <span style={{ color: "var(--accent)", fontWeight: 600 }}>{lang === "zh-CN" ? "注音: " : "注音: "}{e.z}</span>}
                    {e.p && e.p !== "0" && <span style={{ color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "拼音: " : "拼音: "}{e.p}</span>}
                </div>
                <div>{e.d?.slice(0, 300)}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 2, fontSize: 11, color: "var(--text-tertiary)" }}>
                  {e.s && <span>{lang === "zh-CN" ? "相似词: " : "相似詞: "}{e.s}</span>}
                  {e.a && <span>{lang === "zh-CN" ? "相反词: " : "相反詞: "}{e.a}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Left */}
      <div style={{ width: 280, minWidth: 280, padding: 20, display: "flex", flexDirection: "column", gap: 14, overflow: "auto", borderRight: "0.5px solid var(--border)", background: "var(--glass-2)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "输入汉字" : "輸入漢字"}</label>
          <input ref={inputRef} type="text" value={query}
            onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd}
            onChange={handleChange} onBlur={handleBlur}
            style={{ width: "100%", padding: "10px 14px", fontSize: 20, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text)", fontFamily: "var(--font-serif)" }}
            placeholder={lang === "zh-CN" ? "输入汉字" : "輸入漢字"}
          />
        </div>

        <style>{`
          .view-tabs { display: flex; gap: 2px; z-index: 10; }
          .view-tab { padding: 4px 12px; border: 0.5px solid var(--border-subtle); background: var(--glass-2); color: var(--text-tertiary); cursor: pointer; font-size: 12px; font-family: var(--font-serif); border-radius: 0; }
          .view-tab:first-child { border-radius: 6px 0 0 6px; }
          .view-tab:last-child { border-radius: 0 6px 6px 0; }
          .view-tab.active { background: var(--accent-subtle); color: var(--accent); font-weight: 600; border-color: var(--accent); }
        `}</style>

        <div className="view-tabs">
           <div className={`view-tab${mode === "query" ? " active" : ""}`} onClick={() => { setMode("query"); setSubMode("query"); }}>{lang === "zh-CN" ? "方言查询" : "方言查詢"}</div>
          <div className={`view-tab${mode === "dict" ? " active" : ""}`} onClick={() => { setMode("dict"); setSubMode("dict"); }}>{lang === "zh-CN" ? "字典对照" : "字典對照"}</div>
        </div>

        {mode === "query" && query && (<>
          <div style={{ fontSize: 56, textAlign: "center", fontFamily: "var(--font-serif)", color: "var(--accent)", padding: "4px 0" }}>{query}</div>

          {/* ── Language readings (JSON) ── */}
          {Object.keys(readings).filter(k => k !== "def" && k !== "jp_on" && k !== "jp_kun").length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "语言读音" : "語言讀音"}</div>
              {Object.entries(readings)
                .filter(([k]) => k !== "def" && k !== "jp_on" && k !== "jp_kun")
                .map(([lang, reading]) => (
                  <div key={lang} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "8px 12px", borderRadius: 6, background: "var(--bg-overlay)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 68 }}>{LANG_NAME[lang] || lang}</span>
                    <span style={{ fontSize: 15, fontFamily: "var(--font-serif)", color: "var(--text)", wordBreak: "break-all" }}>{reading}</span>
                  </div>))}
            </>
          )}

          {/* ── 中古音 (DB) ── */}
          {coreReadings.filter(r => r.label === "中古音").length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "#c08040", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "中古音" : "中古音"}</div>
              {coreReadings.filter(r => r.label === "中古音").map(r => (
                <div key="mc" style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "8px 12px", borderRadius: 6, background: "var(--bg-overlay)", borderLeft: "3px solid #c08040" }}>
                  <span style={{ fontSize: 12, color: "#c08040", minWidth: 68 }}>{lang === "zh-CN" ? "中古音" : "中古音"}</span>
                  <span style={{ fontSize: 15, fontFamily: "var(--font-serif)", color: "var(--accent)", wordBreak: "break-all" }}>{r.reading}</span>
                </div>))}
            </>
          )}

          {/* ── 日语读音层次 ── */}
          {(jpReadings.length > 0 || readings.jp_on || readings.jp_kun) && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "日语读音" : "日語讀音"}</div>
              {jpReadings.map(r => (
                <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 80 }}>{r.label}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--text)", wordBreak: "break-all" }}>{r.reading}</span>
                </div>))}
              {jpReadings.length === 0 && readings.jp_on && (
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 68 }}>{lang === "zh-CN" ? "日语(音)" : "日語(音)"}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--text)", wordBreak: "break-all" }}>{readings.jp_on}</span>
                </div>)}
              {jpReadings.length === 0 && readings.jp_kun && (
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 68 }}>{lang === "zh-CN" ? "日语(训)" : "日語(訓)"}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--text)", wordBreak: "break-all" }}>{readings.jp_kun}</span>
                </div>)}
            </>
          )}

          {/* ── 方言读音 (DB: sh, mn) ── */}
          {coreReadings.filter(r => r.label !== "中古音").length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "方言读音" : "方言讀音"}</div>
              {coreReadings.filter(r => r.label !== "中古音").map(r => (
                <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 68 }}>{r.label}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--text)", wordBreak: "break-all" }}>{r.reading}</span>
                </div>))}
            </>
          )}

          {/* ── 释义 ── */}
          {readings.def && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "释义" : "釋義"}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-overlay)", padding: "8px 12px", borderRadius: 6, lineHeight: 1.6 }}>
                {readings.def}
              </div>
            </>
          )}

          {/* ── 萌典 ── */}
          {moeData?.[query] && (
            <>
              <div style={{ fontSize: 12, color: "#2E7D32", fontWeight: 600, marginBottom: -4 }}>《萌典》</div>
              {moeData[query].slice(0, 5).map((e: any, i: number) => (
                <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {e.w && <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{e.w}</div>}
                  <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                    {e.z && <span style={{ color: "var(--accent)", fontWeight: 600 }}>{lang === "zh-CN" ? "注音: " : "注音: "}{e.z}</span>}
                    {e.p && e.p !== "0" && <span style={{ color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "拼音: " : "拼音: "}{e.p}</span>}
                  </div>
                  {e.d && <div>{e.d.slice(0, 200)}</div>}
                  <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
              {e.s && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "相似词: " : "相似詞: "}{e.s}</span>}
              {e.a && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "相反词: " : "相反詞: "}{e.a}</span>}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Unicode 信息 ── */}
          {unihanExtra?.[query] && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: -4 }}>{lang === "zh-CN" ? "Unicode 信息" : "Unicode 信息"}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "6px 10px", borderRadius: 6, background: "var(--bg-overlay)" }}>
            {unihanExtra[query].cj && <span>{lang === "zh-CN" ? "仓颉码: " : "倉頡碼: "}<strong style={{ color: "var(--accent)" }}>{unihanExtra[query].cj}</strong></span>}
            {unihanExtra[query].fc && <span>{lang === "zh-CN" ? "四角码: " : "四角碼: "}<strong style={{ color: "var(--accent)" }}>{unihanExtra[query].fc}</strong></span>}
                {unihanExtra[query].ts && <span>{lang === "zh-CN" ? "笔画数: " : "筆畫數: "}{unihanExtra[query].ts}</span>}
                {unihanExtra[query].gl && <span>{lang === "zh-CN" ? "年级: " : "年級: "}{unihanExtra[query].gl}</span>}
              </div>
            </>
          )}

          {/* ── Xiaoxuetang 声韵调 ── */}
          {Object.keys(xxReadings).length > 0 && (
            <details open style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, color: "#6B3FA0", fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
                {lang === "zh-CN" ? "声韵调 " : "聲韻調 "}
                <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                  ({Object.keys(xxReadings).length} {lang === "zh-CN" ? "方言点" : "方言點"})
                </span>
              </summary>
              <div style={{ maxHeight: 240, overflow: "auto", marginTop: 4 }}>
                {Object.entries(xxReadings).sort(([a], [b]) => {
                  const ga = xxOverlap?.[a]?.group || "";
                  const gb = xxOverlap?.[b]?.group || "";
                  return ga.localeCompare(gb) || a.localeCompare(b);
                }).map(([ptName, entries]) => {
                  const grp = xxOverlap?.[ptName]?.group || "";
                  const e = entries[0];
                  if (!e) return null;
                  const tv = parseInt(e.tone_value) || 0;
                  const hue = tv > 0 ? (tv - 1) * 45 : 0;
                  return (
                    <div key={ptName} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 6px", fontSize: 11, borderBottom: "0.5px solid var(--border-subtle)" }}>
                      <span style={{ minWidth: 36, fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>{grp}</span>
                      <span style={{ minWidth: 64, color: "var(--text-secondary)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ptName}>{ptName}</span>
                      <span style={{ color: "var(--accent)", fontWeight: 600, minWidth: 28 }}>{e.initial || "-"}</span>
                      <span style={{ color: "var(--text)", minWidth: 36 }}>{e.final || "-"}</span>
                      <span style={{ color: `oklch(0.55 0.14 ${hue})`, fontWeight: 600, minWidth: 24, textAlign: "right" }}>{e.tone_value || "-"}</span>
                      <span style={{ color: "var(--text-tertiary)", fontSize: 10, minWidth: 32 }}>{e.tone_category || "-"}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* ── Empty state ── */}
          {Object.keys(readings).length === 0 && coreReadings.length === 0 && jpReadings.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>{lang === "zh-CN" ? "暂无读音数据" : "暫無讀音數據"}</p>
          )}
        </>)}

        {mode === "dict" && query && (
          <>
            <div style={{ fontSize: 56, textAlign: "center", fontFamily: "var(--font-serif)", color: "var(--accent)", padding: "4px 0" }}>{query}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.8 }}>
              {DICT_INFO.map(d => (
                <div key={d.key} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{d.label}</span>
                  <span style={{ fontSize: 10 }}>{d.key === "moe" ? (lang === "zh-CN" ? (d as any).descZh : (d as any).descTw) : d.desc}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {variantChars.length > 0 && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "异体字：" : "異體字："}{variantChars.join("、")}</div>}
      </div>

      {/* Center */}
      {mode === "query" ? (
        <div key="map" ref={mapRef} style={{ flex: 1, height: "100%" }} />
      ) : (
        <div key="dict" style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, padding: 16, overflow: "auto", alignContent: "start" }}>
          {DICT_INFO.map(d => (
            <div key={d.key} style={{
              borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--glass-1)", overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{
                padding: "8px 14px", borderBottom: "1px solid var(--border)",
                background: `linear-gradient(135deg, ${d.color}22 0%, transparent 100%)`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{d.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>{d.key === "moe" ? (lang === "zh-CN" ? (d as any).descZh : (d as any).descTw) : d.desc}</span>
              </div>
              <div style={{ padding: 14, flex: 1, overflow: "auto", maxHeight: "calc(50vh - 40px)" }}>
                {renderDictEntry(d.key)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right */}
      {mode === "query" ? (
        <div style={{ width: 280, minWidth: 280, display: "flex", flexDirection: "column", borderLeft: "0.5px solid var(--border)", background: "var(--glass-2)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" }}>
          <div style={{ padding: "16px 20px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>
             {lang === "zh-CN" ? `方言读音 (${readingPointIds.size})` : `方言讀音 (${readingPointIds.size})`}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {!query || displayDetails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                {query ? (lang === "zh-CN" ? "暂无方言读音数据" : "暫無方言讀音數據") : (lang === "zh-CN" ? "请输入汉字查询" : "請輸入漢字查詢")}
              </div>
            ) : displayDetails.map((item, idx) => (
              <div key={`${item.pointId}-${idx}`}
                onClick={() => { const pt = dialects?.points.find(p => p.id === item.pointId); if (pt) selectDialect(pt); }}
                style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", borderRadius: 6, background: "var(--bg-overlay)", cursor: "pointer", transition: "background 0.15s", border: "0.5px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-overlay)"; e.currentTarget.style.borderColor = "transparent"; }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 68, flexShrink: 0 }}>{item.pointName}</span>
                  <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--accent)", wordBreak: "break-all" }}>{item.reading}</span>
                </div>
                {item.comment && <div style={{ fontSize: 11, color: "var(--text-tertiary)", paddingLeft: 80, lineHeight: 1.4 }}>{item.comment.slice(0, 60)}</div>}
              </div>))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
