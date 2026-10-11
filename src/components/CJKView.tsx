/**
 * CJKView.tsx — 汉日韩越跨语言读音对比
 * v2: left panel layout like NushuView
 */
import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";

interface CJKReadingsData {
  charIndex: Record<string, Record<string, string[]>>;
  langNames: Record<string, string>;
}

const LANG_KEYS = ["ja_kanon", "ja_goon", "ja_touon", "ja_kanyouon", "ko", "vi"] as const;
const LANG_COLORS: Record<string, string> = {
  ja_kanon: "#e74c3c",
  ja_goon: "#e67e22",
  ja_touon: "#f1c40f",
  ja_kanyouon: "#9b59b6",
  ko: "#2ecc71",
  vi: "#3498db",
};

export function CJKView() {
  const lang = useAppStore((s) => s.lang);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const [cjkData, setCjkData] = useState<CJKReadingsData | null>(null);
  const [char, setChar] = useState("中");
  const [showDialect, setShowDialect] = useState(true);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    fetch("/data/cjk_readings.json")
      .then((r) => r.json())
      .then((d) => setCjkData(d))
      .catch(() => {});
  }, []);

  const entry = useMemo(() => {
    if (!cjkData || !char) return null;
    return cjkData.charIndex[char] || null;
  }, [cjkData, char]);

  const handleCJKClick = (langKey: string, reading: string) => {
    const langName = cjkData?.langNames[langKey] || langKey;
    selectDialect({
      id: `__cjk__${langKey}`,
      name: char,
      title: `${langName} — ${char}`,
      lat: 0, lng: 0,
      region: "域外方音", group: langName, subgroup: "",
      broad: "域外方音",
      color: LANG_COLORS[langKey] || "#a0a0a0",
      symbol: "",
      ydFenqu: "域外方音", csFenqu: "",
      source: "", contributor: "",
      location: langName,
      markerColor: LANG_COLORS[langKey] || "#a0a0a0",
      sampleWords: [{ concept: char, conceptZh: char, ipa: reading }],
    });
  };

  const langNameMap = cjkData?.langNames || {};

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Left panel */}
      <div style={{ width: 280, minWidth: 280, padding: 20, display: "flex", flexDirection: "column", gap: 14, borderRight: "0.5px solid var(--border)", background: "var(--glass-2)", overflow: "auto" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "输入汉字" : "輸入漢字"}</label>
          <input
            type="text"
            value={char}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => { setComposing(false); setChar((e.data || e.currentTarget.value).slice(-1)); }}
            onChange={(e) => { if (!composing) setChar(e.target.value.slice(-1)); }}
            maxLength={1}
            style={{ width: "100%", padding: "10px 14px", marginTop: 4, fontSize: 22, textAlign: "center", border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text)", fontFamily: "var(--font-serif)", outline: "none" }}
            placeholder={lang === "zh-CN" ? "字" : "字"}
          />
        </div>
        <label style={{ fontSize: 12, color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showDialect} onChange={(e) => setShowDialect(e.target.checked)} />
          {lang === "zh-CN" ? "显示方言读音" : "顯示方言讀音"}
        </label>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
          <p>{lang === "zh-CN"
            ? "汉日韩越（CJK）跨语言读音比较。输入一个汉字，查看其日语（漢音·呉音·唐宋音·慣用音）、韩语、越南语中的读音与使用情况。"
            : "漢日韓越（CJK）跨語言讀音比較。輸入一個漢字，查看其日語（漢音·呉音·唐宋音·慣用音）、韓語、越南語中的讀音與使用情況。"
          }</p>
        </div>
        {char && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-overlay)", border: "0.5px solid var(--border)" }}>
            <div style={{ fontSize: 64, textAlign: "center", fontFamily: "var(--font-serif)", color: "var(--accent)", lineHeight: 1 }}>{char}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 4 }}>
              {entry ? (lang === "zh-CN" ? "已收录" : "已收錄") : (lang === "zh-CN" ? "暂无数据" : "暫無數據")}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {cjkData ? `${Object.keys(cjkData.charIndex).length} ${lang === "zh-CN" ? "字" : "字"}` : (lang === "zh-CN" ? "加载中..." : "載入中...")}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!char ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60, fontSize: 14 }}>
            {lang === "zh-CN" ? "请输入一个汉字" : "請輸入一個漢字"}
          </div>
        ) : !entry ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60, fontSize: 14 }}>
            「{char}」{lang === "zh-CN" ? "暂无 CJK 跨语言读音数据" : "暫無 CJK 跨語言讀音數據"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {LANG_KEYS.map((langKey) => {
              const readings = entry[langKey];
              if (!readings || readings.length === 0) return null;
              const name = langNameMap[langKey] || langKey;
              const color = LANG_COLORS[langKey] || "#a0a0a0";
              return (
                <div key={langKey} style={{
                  background: "var(--glass-2)", borderRadius: 10,
                  border: "0.5px solid var(--border-subtle)",
                  padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                    {name}
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>({readings.length})</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {readings.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleCJKClick(langKey, r)}
                        style={{
                          padding: "4px 10px", fontSize: 13,
                          background: "var(--bg-overlay)", borderRadius: 6,
                          border: "0.5px solid var(--border-subtle)",
                          color: "var(--text)", cursor: "pointer",
                          fontFamily: "var(--font-mono)", transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = color + "22"; (e.target as HTMLButtonElement).style.borderColor = color; }}
                        onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "var(--bg-overlay)"; (e.target as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; }}
                      >
                        {r.replace(/\*\*/g, '')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {LANG_KEYS.every((k) => !entry[k] || entry[k].length === 0) && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-tertiary)", padding: 20, fontSize: 14 }}>
                {lang === "zh-CN" ? "该字暂无 CJK 语言读音数据" : "該字暫無 CJK 語言讀音數據"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
