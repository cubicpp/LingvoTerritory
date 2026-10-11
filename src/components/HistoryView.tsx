/**
 * HistoryView.tsx — 历史音变时间线
 * v7.0: Sankey tab removed; timeline only.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { initDictDb, getJapaneseReadings, getCoreReadings } from "@/lib/sqlite";

interface Period {
  name: string;
  year: string;
  source: string;
  readings: { label: string; ipa: string }[];
}

export function HistoryView() {
  const charReadings = useAppStore((s) => s.dataCache.charReadings);
  const ocData = useAppStore((s) => s.dataCache.ocPhonology);
  const lang = useAppStore((s) => s.lang);
  const mcData = useAppStore((s) => s.dataCache.mcPhonology);
  const theme = useAppStore((s) => s.theme);
  const dk = theme === "dark";
  const [zymyData, setZymy] = useState<any>(null);
  const [query, setQuery] = useState("東");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [variantMap, setVariantMap] = useState<Record<string, string[]> | null>(null);
  const [zzOcData, setZzOcData] = useState<any[] | null>(null);
  const [laoguoyinData, setLaoguoyinData] = useState<Record<string, string[]> | null>(null);
  const [mengguData, setMengguData] = useState<any[] | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    fetch("/data/zymy_phonology.json").then(r => r.json()).then(setZymy).catch(() => {});
    fetch("/data/variant_map.json").then(r => r.json()).then(setVariantMap).catch(() => {});
    fetch("/data/zhengzhang_oc.json").then(r => r.json()).then(setZzOcData).catch(() => {});
    fetch("/data/laoguoyin.json").then(r => r.json()).then(setLaoguoyinData).catch(() => {});
    fetch("/data/mengguziyun.json").then(r => r.json()).then(setMengguData).catch(() => {});
    initDictDb().catch(() => {});
  }, []);

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

  const lookupChars = useMemo(() => {
    if (!query) return [];
    const chars = [query];
    if (variantMap) {
      for (const [key, variants] of Object.entries(variantMap)) {
        if (key === query || variants.includes(query)) {
          if (!chars.includes(key)) chars.push(key);
          for (const v of variants) { if (!chars.includes(v)) chars.push(v); }
        }
      }
    }
    return chars;
  }, [query, variantMap]);

  // ── Timeline data ──
  useEffect(() => {
    if (!query || !charReadings) return;
    setLoading(true);

    const results: Period[] = [];

    if (ocData) {
      let oc: any = null;
      for (const ch of lookupChars) { oc = ocData.entries?.find((e: any) => e.char === ch); if (oc) break; }
      let zzReading: string | null = null;
      if (zzOcData) {
        for (const ch of lookupChars) {
          const zz = zzOcData.find((e: any) => e.c === ch);
          if (zz?.oc) { zzReading = zz.oc; break; }
        }
      }
      if (oc) {
        const readingsList = [{ label: "拟音(白-沙)", ipa: oc.oc || "" }];
        if (zzReading) readingsList.push({ label: "拟音(郑张)", ipa: zzReading });
        results.push({ name: "上古音", year: "~1000 BCE", source: zzReading ? "Baxter-Sagart (2015) & 郑张尚芳 (2013)" : "Baxter-Sagart (2015)", readings: readingsList });
        if (oc.pinyin) results[results.length - 1].readings.push({ label: "拼音", ipa: oc.pinyin });
      }
    }

    if (mcData?.charDetails) {
      const mcChars: any[] = [];
      for (const [, chars] of Object.entries(mcData.charDetails)) {
        for (const c of (chars as any[])) { if (lookupChars.includes((c as any).c)) mcChars.push(c); }
      }
      if (mcChars.length > 0) {
        const unique = [...new Set(mcChars.map((c: any) => c.r || c.a || ""))].filter(Boolean) as string[];
        results.push({ name: "中古音（广韵）", year: "601 CE", source: "《切韵》/《广韵》", readings: unique.slice(0, 3).map(r => ({ label: "拟音", ipa: r })) });
      }
    }

    if (zymyData?.charDetails) {
      const zyChars: any[] = [];
      for (const [, chars] of Object.entries(zymyData.charDetails)) {
        for (const c of (chars as any[])) { if (lookupChars.includes((c as any).c)) zyChars.push(c); }
      }
      if (zyChars.length > 0) {
        const unique = Array.from(new Set(zyChars.map((c: any) => c.r || ""))).filter(Boolean);
        results.push({ name: "近代音（中原音韵）", year: "1324 CE", source: "周德清《中原音韵》", readings: unique.slice(0, 3).map(r => ({ label: "拟音", ipa: r })) });
      }
    }

    // Menggu Ziyun (Yuan dynasty 'Phags-pa)
    if (mengguData) {
      const mgReadings: string[] = [];
      for (const ch of lookupChars) {
        const found = mengguData.filter((e: any) => e.c === ch);
        for (const f of found) { if (f.r) mgReadings.push(f.r); }
        if (mgReadings.length > 0) break;
      }
      if (mgReadings.length > 0) {
        results.push({ name: "蒙古字韵（八思巴字）", year: "~1300 CE", source: "《蒙古字韵》", readings: mgReadings.slice(0, 3).map(r => ({ label: "拟音", ipa: r })) });
      }
    }

    for (const ch of lookupChars) {
      if (laoguoyinData?.[ch]) {
        results.push({ name: "老国音", year: "1913 CE", source: "《国音字典》(1913)", readings: laoguoyinData[ch].slice(0, 3).map(r => ({ label: "读音", ipa: r })) });
        break;
      }
    }

    for (const ch of lookupChars) {
      if (charReadings.langIndex?.pu?.[ch]) {
        results.push({ name: "普通话", year: "现代", source: "Unihan", readings: [{ label: "拼音", ipa: charReadings.langIndex.pu[ch] }] });
        break;
      }
    }

    const jpReadings = getJapaneseReadings(query);
    if (jpReadings.length > 0) {
      results.push({
        name: "日语读音层次",
        year: "5-14世纪",
        source: "汉和辞典",
        readings: jpReadings.map(r => ({ label: r.label.replace("日语(", "").replace(")", ""), ipa: r.reading })),
      });
    }

    setPeriods(results);
    setLoading(false);
  }, [query, charReadings, ocData, mcData, zymyData, variantMap, lookupChars, zzOcData, laoguoyinData, mengguData]);

  if (!charReadings) {
    return (<div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载数据..." : "載入資料..."}</span></div>);
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 260, minWidth: 260, padding: 20, display: "flex", flexDirection: "column", gap: 16, borderRight: "0.5px solid var(--border)", background: "var(--glass-2)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "输入汉字" : "輸入漢字"}</label>
          <input ref={inputRef} type="text" value={query}
            onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd}
            onChange={handleChange} onBlur={handleBlur}
            style={{ width: "100%", padding: "10px 14px", fontSize: 20, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text)", fontFamily: "var(--font-serif)" }}
            placeholder={lang === "zh-CN" ? "输入汉字" : "輸入漢字"}
          />
        </div>
        {query && (<div style={{ textAlign: "center", fontSize: 72, fontFamily: "var(--font-serif)", color: "var(--accent)" }}>{query}</div>)}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60 }}>{lang === "zh-CN" ? "查询中..." : "查詢中..."}</div>
        ) : periods.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60 }}>{query ? (lang === "zh-CN" ? "暂无该字的历史音韵数据" : "暫無該字的歷史音韻數據") : (lang === "zh-CN" ? "请输入汉字" : "請輸入漢字")}</div>
        ) : periods.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-raised)" }} />
              {i < periods.length - 1 && (<div style={{ width: 2, flex: 1, minHeight: 40, background: "var(--border)" }} />)}
            </div>
            <div style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: "var(--bg-overlay)", border: "0.5px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-serif)" }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.year}</span>
              </div>
              {p.readings.map((r, j) => (
                <div key={j} style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", minWidth: 36 }}>{r.label}</span>
                  <span style={{ fontSize: 18, fontFamily: "var(--font-serif)", color: "var(--accent)" }}>[{r.ipa}]</span>
                </div>))}
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>{p.source}</div>
            </div>
          </div>))}
      </div>
    </div>
  );
}
