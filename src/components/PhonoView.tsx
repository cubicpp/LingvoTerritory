/**
 * PhonoView.tsx — 历史音韵对比（小学堂 6 家上古 + 6 家中古拟音）
 */
import { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

interface SystemEntry {
  char: string;
  initial: string;
  final: string;
  note: string;
}

const TONE_COLORS: Record<string, string> = {
  "高本漢": "#E74C3C", "王力": "#3498DB", "董同龢": "#2ECC71",
  "周法高": "#F39C12", "李方桂": "#9B59B6", "陳新雄": "#1ABC9C",
};

function getSystemColor(name: string): string {
  for (const [k, v] of Object.entries(TONE_COLORS)) {
    if (name.includes(k)) return v;
  }
  return "#a0a0a0";
}

function getSystemShort(name: string): string {
  const m = name.match(/(高本漢|王力|董同龢|周法高|李方桂|陳新雄)/);
  return m ? m[1] : name.split("_").pop() || name;
}

export function PhonoView() {
  const lang = useAppStore((s) => s.lang);
  const [histData, setHistData] = useState<Record<string, Record<string, SystemEntry>> | null>(null);
  const [query, setQuery] = useState("東");
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    fetch("/data/xx_historical.json")
      .then(r => r.json())
      .then(setHistData)
      .catch(() => {});
  }, []);

  const charCode = query.codePointAt(0)?.toString(16).toUpperCase().padStart(5, "0") || "";

  const handleCompositionStart = () => setComposing(true);
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setComposing(false);
    setQuery((e.data || e.currentTarget.value).slice(0, 1));
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(composing ? e.target.value : e.target.value.slice(0, 1));
  };
  const handleBlur = () => {
    if (composing) { setComposing(false); setQuery(q => q.slice(0, 1)); }
  };

  if (!histData) {
    return (<div className="loading-screen"><div className="loading-blob" /><span>{lang === "zh-CN" ? "加载历史音韵..." : "載入歷史音韻..."}</span></div>);
  }

  // Group systems into Old Chinese (先秦), Middle Chinese (隋唐), and rhyme books
  const groups: { label: string; systems: string[] }[] = [];
  const ocSystems: string[] = [];
  const mcSystems: string[] = [];
  const rhymeSystems: string[] = [];

  for (const sys of Object.keys(histData)) {
    if (sys.includes("先秦") || sys.includes("西漢") || sys.includes("東漢")) {
      ocSystems.push(sys);
    } else if (sys.includes("南北朝") || sys.includes("隋唐")) {
      mcSystems.push(sys);
    } else {
      rhymeSystems.push(sys);
    }
  }

  if (ocSystems.length) groups.push({ label: lang === "zh-CN" ? "上古音" : "上古音", systems: ocSystems });
  if (mcSystems.length) groups.push({ label: lang === "zh-CN" ? "中古音" : "中古音", systems: mcSystems });
  if (rhymeSystems.length) groups.push({ label: lang === "zh-CN" ? "韵书" : "韻書", systems: rhymeSystems });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "auto", padding: 20, gap: 16 }}>
      {/* Input */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, whiteSpace: "nowrap" }}>
          {lang === "zh-CN" ? "输入汉字" : "輸入漢字"}
        </span>
        <input
          value={query}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          style={{
            width: 64, padding: "6px 10px", fontSize: 20, textAlign: "center",
            fontFamily: "var(--font-serif)", border: "1px solid var(--border)",
            borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 48, fontFamily: "var(--font-serif)", color: "var(--accent)", lineHeight: 1 }}>{query}</span>
      </div>

      {!Object.values(histData).some(sys => sys[charCode]) ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
          {lang === "zh-CN" ? "该字暂无历史音韵数据" : "該字暫無歷史音韻數據"}
        </div>
      ) : (
        /* Groups side by side */
        <div style={{ display: "flex", gap: 16, flex: 1, overflow: "auto" }}>
          {groups.map(group => {
            const visibleSystems = group.systems.filter(sys => {
              const entry = histData[sys]?.[charCode];
              return entry && (entry.initial || entry.final);
            });
            if (visibleSystems.length === 0) return null;
            return (
            <div key={group.label} style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8, borderBottom: "2px solid var(--accent)", paddingBottom: 4 }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {visibleSystems.map(sys => {
                  const entry = histData[sys]?.[charCode];
                  const short = getSystemShort(sys);
                  const color = getSystemColor(sys);
                  return (
                    <div key={sys} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 8,
                      background: "var(--bg-overlay)",
                      borderLeft: `3px solid ${color}`,
                      opacity: entry ? 1 : 0.4,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 56 }}>{short}</span>
                      {entry ? (
                        <>
                          <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--accent)", fontWeight: 600 }}>
                            {entry.initial || "-"}
                          </span>
                          <span style={{ fontSize: 14, fontFamily: "var(--font-serif)", color: "var(--text)" }}>
                            {entry.final || "-"}
                          </span>
                          {entry.note && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: "auto" }}>{entry.note}</span>}
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
