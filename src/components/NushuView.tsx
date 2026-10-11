/**
 * NushuView.tsx — 江永女书文字展示
 */
import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";

interface NushuEntry {
  n: string;  // 女书字符
  c: string;  // 对应汉字
  r: string;  // 江永方言发音
  s: string;  // 字帖序号
}

export function NushuView() {
  const theme = useAppStore((s) => s.theme);
  const lang = useAppStore((s) => s.lang);
  const [data, setData] = useState<NushuEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NushuEntry | null>(null);
  const dk = theme === "dark";

  useEffect(() => {
    fetch("/data/nushu.json").then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search) return data.slice(0, 200);
    return data.filter(e =>
      e.c.includes(search) || e.r.includes(search) || e.n.includes(search)
    );
  }, [data, search]);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <style>{`
        .nushu-char { font-family: var(--font-nushu), var(--font-serif), serif; }
        .nushu-grid-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px; border-radius: 8px;
          border: 0.5px solid var(--border); background: var(--glass-2);
          cursor: pointer; transition: background 0.15s;
        }
        .nushu-grid-btn:hover { background: var(--glass-3); }
        .nushu-grid-btn.sel { border-color: var(--accent); background: var(--accent-subtle); }
      `}</style>
      <div style={{ width: 280, minWidth: 280, padding: 20, display: "flex", flexDirection: "column", gap: 14, borderRight: "0.5px solid var(--border)", background: "var(--glass-2)", overflow: "auto" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{lang === "zh-CN" ? "检索（汉字/读音）" : "檢索（漢字/讀音）"}</label>
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", marginTop: 4, border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg-overlay)", color: "var(--text)", fontSize: 14, fontFamily: "var(--font-serif)" }}
            placeholder={lang === "zh-CN" ? "输入汉字或拼音" : "輸入漢字或拼音"}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6, fontFamily: "var(--font-serif)" }}>
          <p>
            {lang === "zh-CN" ? "女书" : "女書"}
            （<span className="nushu-char" style={{ fontSize: 13 }}>𛆁𛈬</span>）
            {lang === "zh-CN"
              ? "是湖南省江永县流传的女性专用文字，是世界上唯一的性别文字。起源于明清时期，用于书写湘南土话。"
              : "是湖南省江永縣流傳的女性專用文字，是世界上唯一的性別文字。起源於明清時期，用於書寫湘南土話。"
            }
          </p>
        </div>
        {selected && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-overlay)", border: "0.5px solid var(--border)" }}>
            <div className="nushu-char" style={{ fontSize: 64, textAlign: "center", color: "var(--accent)", marginBottom: 8 }}>{selected.n}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>{lang === "zh-CN" ? "对应汉字: " : "對應漢字: "}<strong style={{ color: "var(--text)" }}>{selected.c}</strong></div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 4 }}>{lang === "zh-CN" ? "江永方言: " : "江永方言: "}{selected.r}</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, alignContent: "start" }}>
        {filtered.map((e, i) => (
          <button
            key={i}
            className={`nushu-grid-btn${selected?.n === e.n ? " sel" : ""}`}
            onClick={() => setSelected(e)}
            title={`${e.n} = ${e.c} (${e.r})`}
          >
            <span className="nushu-char" style={{ fontSize: 28, color: "var(--text)" }}>{e.n}</span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{e.c}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-tertiary)", padding: 40, fontSize: 14, fontFamily: "var(--font-serif)" }}>
            未找到匹配
          </div>
        )}
      </div>
    </div>
  );
}
