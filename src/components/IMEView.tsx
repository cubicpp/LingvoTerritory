/**
 * IMEView.tsx — 编码透视：输入法编码查询
 * v2: left panel layout like NushuView
 */
import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";

interface IMECodes {
  [char: string]: {
    wb86?: string;
    wb98?: string;
    cj3?: string;
    cj5?: string;
  };
}

const IME_NAMES: Record<string, string> = {
  wb86: "五笔86",
  wb98: "五笔98",
  cj3: "倉頡三代",
  cj5: "倉頡五代",
};

const IME_KEYS = ["wb86", "wb98", "cj3", "cj5"] as const;
const IME_COLORS: Record<string, string> = {
  wb86: "#e74c3c",
  wb98: "#e67e22",
  cj3: "#2ecc71",
  cj5: "#3498db",
};

const WB_ZONES: Record<string, { name: string; color: string }> = {
  "1": { name: "横 GFDSA", color: "#e74c3c" },
  "2": { name: "竖 HJKLM", color: "#2ecc71" },
  "3": { name: "撇 TREWQ", color: "#3498db" },
  "4": { name: "捺 YUIOP", color: "#f1c40f" },
  "5": { name: "折 NBVCX", color: "#9b59b6" },
};

const ZONE_NAMES = ["横", "竖", "撇", "捺", "折"];

export function IMEView() {
  const lang = useAppStore((s) => s.lang);
  const [imeData, setImeData] = useState<IMECodes | null>(null);
  const [charMeta, setCharMeta] = useState<any>(null);
  const [char, setChar] = useState("中");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    fetch("/data/ime_codes.json").then((r) => r.json()).then(setImeData).catch(() => {});
    fetch("/data/char_meta.json").then((r) => r.json()).then(setCharMeta).catch(() => {});
  }, []);

  const entry = useMemo(() => {
    if (!imeData || !char) return null;
    return imeData[char] || null;
  }, [imeData, char]);

  const meta = useMemo(() => {
    if (!charMeta || !char) return null;
    return charMeta[char] || null;
  }, [charMeta, char]);

  const reverseSearch = (code: string) => {
    if (!imeData || !code) { setSearchResults([]); return; }
    const upper = code.toUpperCase();
    const results: string[] = [];
    for (const [ch, codes] of Object.entries(imeData)) {
      if (codes.wb86?.toUpperCase() === upper || codes.wb98?.toUpperCase() === upper ||
          codes.cj3?.toUpperCase() === upper || codes.cj5?.toUpperCase() === upper) {
        results.push(ch);
        if (results.length >= 200) break;
      }
    }
    setSearchResults(results);
  };

  const wubiZones = useMemo(() => {
    if (!entry?.wb86) return [];
    const code = entry.wb86.toLowerCase();
    const zoneMap: Record<string, string> = {
      g: "1", f: "1", d: "1", s: "1", a: "1",
      h: "2", j: "2", k: "2", l: "2", m: "2",
      t: "3", r: "3", e: "3", w: "3", q: "3",
      y: "4", u: "4", i: "4", o: "4", p: "4",
      n: "5", b: "5", v: "5", c: "5", x: "5",
    };
    return code.split("").map(ch => zoneMap[ch] || "5");
  }, [entry]);

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

        <div>
          <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "编码反查" : "編碼反查"}</label>
          <input
            type="text"
            value={searchCode}
            onChange={(e) => { setSearchCode(e.target.value); reverseSearch(e.target.value); }}
            style={{ width: "100%", padding: "8px 12px", marginTop: 4, fontSize: 14, fontFamily: "var(--font-mono)", border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg-overlay)", color: "var(--text)", outline: "none" }}
            placeholder="e.g. K"
          />
          {searchResults.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{searchResults.length} 字匹配</div>
          )}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
          <p>{lang === "zh-CN"
            ? "编码透视——查看汉字的多种输入法编码（五笔86/98、倉頡三代/五代），支持编码反查汉字与五笔分区拆解。"
            : "編碼透視——查看漢字的多種輸入法編碼（五筆86/98、倉頡三代/五代），支援編碼反查漢字與五筆分區拆解。"
          }</p>
        </div>

        {/* Search result grid */}
        {searchResults.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {searchResults.slice(0, 100).map((ch) => (
              <button
                key={ch}
                onClick={() => { setChar(ch); setSearchCode(""); setSearchResults([]); }}
                style={{
                  width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, fontFamily: "var(--font-han)", color: "var(--text)",
                  background: "var(--bg-overlay)", border: "0.5px solid var(--border-subtle)",
                  borderRadius: 6, cursor: "pointer",
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        )}

        {char && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-overlay)", border: "0.5px solid var(--border)" }}>
            <div style={{ fontSize: 64, textAlign: "center", fontFamily: "var(--font-serif)", color: "var(--accent)", lineHeight: 1 }}>{char}</div>
            {meta && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                {meta.s && <div>笔画：<b>{meta.s}</b></div>}
                {meta.r && <div>部首：<b style={{ fontFamily: "var(--font-han)" }}>{meta.r}</b>{meta.rs ? ` +${meta.rs}` : ""}</div>}
                {meta.g && <div>级别：<b>{meta.g}</b></div>}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {imeData ? `${Object.keys(imeData).length} ${lang === "zh-CN" ? "字" : "字"}` : (lang === "zh-CN" ? "加载中..." : "載入中...")}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!char && searchResults.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: 60, fontSize: 14 }}>
            {lang === "zh-CN" ? "请输入一个汉字或编码进行查询" : "請輸入一個漢字或編碼進行查詢"}
          </div>
        ) : (
          <>
            {char && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {IME_KEYS.map((key) => {
                    const code = entry?.[key];
                    const name = IME_NAMES[key];
                    const color = IME_COLORS[key];
                    return (
                      <div key={key} style={{ background: "var(--glass-2)", borderRadius: 10, border: "0.5px solid var(--border-subtle)", padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                          {name}
                        </div>
                        {code ? (
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--text)", letterSpacing: 4, padding: "8px 0" }}>{code}</div>
                        ) : (
                          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{lang === "zh-CN" ? "无编码" : "無編碼"}</div>
                        )}
                      </div>
                    );
                  })}
                  {!entry && (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-tertiary)", padding: 20, fontSize: 14 }}>
                      「{char}」{lang === "zh-CN" ? "暂无输入法编码数据" : "暫無輸入法編碼數據"}
                    </div>
                  )}
                </div>

                {wubiZones.length > 0 && (
                  <div style={{ background: "var(--glass-2)", borderRadius: 10, border: "0.5px solid var(--border-subtle)", padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>
                      {lang === "zh-CN" ? "五笔86 分区拆解" : "五筆86 分區拆解"}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {entry!.wb86!.split("").map((key: string, i: number) => {
                        const zone = wubiZones[i];
                        const zoneInfo = WB_ZONES[zone];
                        return (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: zoneInfo.color + "22", borderRadius: 8, border: `1.5px solid ${zoneInfo.color}`, fontSize: 18, fontFamily: "var(--font-mono)", fontWeight: 600, color: zoneInfo.color }}>
                              {key.toUpperCase()}
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{ZONE_NAMES[parseInt(zone) - 1]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
