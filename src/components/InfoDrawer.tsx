/**
 * InfoDrawer.tsx — 方言详情抽屉
 * 分类路径 + 地点 + 来源 + 贡献者 + 最近方言
 */
import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import * as echarts from "echarts";
import { useAppStore, BROAD_COLORS } from "@/store/useAppStore";
import { getBroadColor } from "@/lib/colors";
import { t } from "@/lib/i18n";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function GroupInfo() {
  const d = useAppStore((s) => s.selectedDialect)!;
  const selectDialect = useAppStore((s) => s.selectDialect);
  const lang = useAppStore((s) => s.lang);
  const points = useAppStore((s) => s.dataCache.dialects?.points);
  const members = d.groupMembers || [];
  const color = getBroadColor(d.broad);
  const [charFilter, setCharFilter] = useState("");
  const [visible, setVisible] = useState(300);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible when filter or members change
  useEffect(() => { setVisible(300); }, [charFilter, members.length]);

  // Component character list (from ComponentSearchView)
  const isCompChars = d.id.startsWith("__comp__");
  const filtered = useMemo(() => {
    if (!isCompChars) return [] as any[];
    return charFilter
      ? members.filter((m: any) => m.name.includes(charFilter))
      : members;
  }, [isCompChars, charFilter, members]);

  // IntersectionObserver for virtual scroll (comp chars only)
  useEffect(() => {
    if (!isCompChars || visible >= filtered.length || !sentinelRef.current || !gridRef.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(v => Math.min(v + 300, filtered.length));
      },
      { root: gridRef.current, rootMargin: "200px" }
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [isCompChars, visible, filtered.length]);

  if (isCompChars && members.length > 0) {
    const compChar = d.name;
    const idsData = (d as any)._idsData;
    return (
      <div key={d.id}>
        <div className="drawer-headline">{lang === "zh-CN" ? `部件 ${compChar}` : `部件 ${compChar}`}</div>
        <div className="drawer-group" style={{ marginBottom: 8 }}>
          <span className="drawer-group__dot" style={{ background: BROAD_COLORS["未分类"] || "#a0a0a0" }} />
           <span className="drawer-group__label">{lang === "zh-CN" ? `共 ${members.length} 字${charFilter ? ` · 筛选 ${filtered.length} 字` : ""}` : `共 ${members.length} 字${charFilter ? ` · 篩選 ${filtered.length} 字` : ""}`}</span>
        </div>
        <input type="text" placeholder={lang === "zh-CN" ? "检索汉字..." : "檢索漢字..."} value={charFilter}
          onChange={(e) => setCharFilter(e.target.value)}
          style={{ width: "100%", padding: "6px 10px", marginBottom: 10, border: "0.5px solid var(--border)", borderRadius: 6, background: "var(--bg-overlay)", color: "var(--text)", fontSize: 13, outline: "none" }}
        />
        <div ref={gridRef} style={{ display: "flex", flexWrap: "wrap", gap: 4, overflowY: "auto", maxHeight: "calc(100vh - 260px)", alignContent: "flex-start" }}>
          {filtered.slice(0, visible).map((m: any, i: number) => (
            <button key={i}
              onClick={() => { const dw = window.open(`https://www.zdic.net/hans/${encodeURIComponent(m.name)}`, "_blank"); if (dw) dw.focus(); }}
              title={idsData?.charIds?.[m.name] ? `${m.name} = ${idsData.charIds[m.name]}` : m.name}
              style={{
                width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontFamily: "var(--font-han)", color: "var(--text)",
                background: "var(--glass-2)", border: "0.5px solid var(--border-subtle)",
                borderRadius: 6, cursor: "pointer", padding: 0,
              }}>
              {m.name}
            </button>
          ))}
          {visible < filtered.length && (
            <div ref={sentinelRef} style={{ width: "100%", textAlign: "center", padding: 12, color: "var(--text-tertiary)", fontSize: 11 }}>
              {lang === "zh-CN" ? `加载中… (${visible}/${filtered.length})` : `載入中… (${visible}/${filtered.length})`}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Character card list (from phonology matrix click)
  const isMcChars = (d as any)._isMcChars;
  if (isMcChars && members.length > 0) {
    const filtered = charFilter
      ? members.filter((m: any) => {
          const c = m.c || m.name || m.title || m;
          const f = m.f || "";
          const g = m.g || "";
          return (c + f + g).includes(charFilter);
        })
      : members;
    return (
      <div key={d.id}>
        <div className="drawer-headline">{d.title || d.name}</div>
        <div className="drawer-group" style={{ marginBottom: 8 }}>
          <span className="drawer-group__dot" style={{ background: BROAD_COLORS["官话"] || "#c43a31" }} />
          <span className="drawer-group__label">{lang === "zh-CN" ? `共 ${members.length} 字${charFilter ? ` · 筛选 ${filtered.length} 字` : ""}` : `共 ${members.length} 字${charFilter ? ` · 篩選 ${filtered.length} 字` : ""}`}</span>
        </div>
        <input
          type="text"
          placeholder={lang === "zh-CN" ? "检索汉字、反切、释义..." : "檢索漢字、反切、釋義..."}
          value={charFilter}
          onChange={(e) => setCharFilter(e.target.value)}
          style={{
            width: "100%", padding: "6px 10px", marginBottom: 10,
            border: "0.5px solid var(--border)", borderRadius: 6,
            background: "var(--bg-overlay)", color: "var(--text)",
            fontSize: 13, outline: "none",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
          {filtered.slice(0, 100).map((item: any, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "baseline", gap: 12,
              padding: "8px 12px", borderRadius: 8,
              background: "var(--bg-overlay)",
            }}>
              <span style={{
                fontSize: 48, fontFamily: "var(--font-serif)",
                color: "var(--text)", lineHeight: 1, minWidth: 56, textAlign: "center",
              }}>
                {item.c || item.name || item.title || item}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                {item.f && (
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {lang === "zh-CN" ? "反切注音" : "反切注音"}：{item.f}
                  </span>
                )}
                <span style={{ fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-serif)" }}>
                  [{item.r || ""}]
                </span>
                {item.g && (
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                    {item.g}
                  </span>
                )}
              </div>
            </div>
          ))}
          {members.length > 100 && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: 8 }}>
              ... 还有 {members.length - 100} 字
            </div>
          )}
        </div>
      </div>
    );
  }

  const displayList = members;

  const handleClickMember = (member: typeof members[0]) => {
    selectDialect(member);
  };

  // If scatter metrics exist, show distance analysis
  const hasMetrics = (d as any).intraAvgDist !== undefined;
  if (hasMetrics && members.length > 0) {
    const md = d as any;
  return (
    <div key={d.id}>
      <div className="drawer-headline">{d.title || d.name}</div>
        <div className="drawer-group" style={{ marginBottom: 16 }}>
          <span className="drawer-group__dot" style={{ background: color }} />
          <span className="drawer-group__label" style={{ color }}>{d.broad}</span>
        </div>
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "距离分析指标" : "距離分析指標"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div>{lang === "zh-CN" ? "样本点数" : "樣本點數"}: <strong>{members.length}</strong></div>
            <div>{lang === "zh-CN" ? "类内离散度" : "類內離散度"}: <strong>{md.intraAvgDist?.toFixed(4)}</strong> (MDS {lang === "zh-CN" ? "平均距离" : "平均距離"})</div>
            <div>{lang === "zh-CN" ? "地理跨度" : "地理跨度"}: <strong>{md.geoSpanKm?.toFixed(0)} km</strong> ({lang === "zh-CN" ? "经纬度极差" : "經緯度極差"})</div>
            {md.nearestGroup && (
              <div>{lang === "zh-CN" ? "最近邻大类" : "最近鄰大類"}: <strong style={{ color: getBroadColor(md.nearestGroup) }}>{md.nearestGroup}</strong>，{lang === "zh-CN" ? "距离" : "距離"} {md.nearestDist?.toFixed(4)}</div>
            )}
          </div>
        </div>
        {md.interGroupDists && Object.keys(md.interGroupDists).length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section__title">{lang === "zh-CN" ? "类间距离" : "類間距離"}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: 2 }}>
              {Object.entries(md.interGroupDists as Record<string, number>)
                .sort(([,a], [,b]) => a - b)
                .slice(0, 15)
                .map(([grp, dist]) => (
                  <div key={grp} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                    <span style={{ color: getBroadColor(grp) }}>{grp}</span>
                    <span>{dist.toFixed(4)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? `共 ${members.length} 个方言点` : `共 ${members.length} 個方言點`}</div>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {displayList.map((m, i) => (
              <div key={m.id} onClick={(e) => { e.stopPropagation(); handleClickMember(m); }}
                style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-overlay)" }}>
                <span style={{ color: getBroadColor(m.broad), marginRight: 6 }}>●</span>
                {m.title || m.name || (lang === "zh-CN" ? "(未知)" : "(未知)")}
                {m.location && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-tertiary)" }}>{m.location}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="drawer-headline">{d.title || d.name}</div>
      <div className="drawer-group" style={{ marginBottom: 16 }}>
        <span className="drawer-group__dot" style={{ background: color }} />
        <span className="drawer-group__label" style={{ color }}>{d.broad}{d.region && ` · ${d.region}`}</span>
      </div>
      <div className="drawer-section">
        <div className="drawer-section__title">{lang === "zh-CN" ? `共 ${members.length} 个方言点` : `共 ${members.length} 個方言點`}</div>
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {displayList.map((m, i) => (
            <div key={m.id} onClick={(e) => { e.stopPropagation(); handleClickMember(m); }}
              style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-overlay)" }}>
              <span style={{ color: getBroadColor(m.broad), marginRight: 6 }}>●</span>
              {m.title || m.name || "(未知)"}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DialectInfo() {
  const d = useAppStore((s) => s.selectedDialect);
  const lang = useAppStore((s) => s.lang);
  const points = useAppStore((s) => s.dataCache.dialects?.points);
  if (!d) return null;

  const nearest = useMemo(() => {
    if (!points) return [];
    return points
      .filter((p) => p.id !== d.id)
      .map((p) => ({ ...p, dist: Math.sqrt((p.lat - d.lat) ** 2 + (p.lng - d.lng) ** 2) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  }, [points, d.id, d.lat, d.lng]);

  if (d.id.startsWith("__group__") || d.id.startsWith("__map__") || d.id.startsWith("__mc__") || d.id.startsWith("__chord__") || d.id.startsWith("__comp__") || d.id.startsWith("__cjk__")) {
    return <GroupInfo />;
  }

  const color = getBroadColor(d.broad);

  return (
    <div key={d.id}>
      <div className="drawer-headline">{d.title || d.name}</div>
      <div className="drawer-subtitle">{d.name}</div>

      {/* Classification badge */}
      <div className="drawer-group" style={{ marginBottom: 16 }}>
        <span className="drawer-group__dot" style={{ background: color }} />
        <span className="drawer-group__label" style={{ color }}>
          {d.broad}
          {d.region && ` · ${d.region}`}
        </span>
      </div>

      {/* Classification path */}
      <div className="drawer-section">
        <div className="drawer-section__title">{lang === "zh-CN" ? "分类路径" : "分類路徑"}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          {d.region || "—"} › {d.group || "—"} › {d.subgroup || "—"}
        </div>
      </div>

      {/* 音典分区 & 陈邡分区 */}
      <div className="drawer-section">
        <div className="drawer-section__title">{lang === "zh-CN" ? "分区编码" : "分區編碼"}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
           {d.ydFenqu && <span>{lang === "zh-CN" ? "音典分区" : "音典分區"}: <strong style={{ color: "var(--accent)" }}>{d.ydFenqu}</strong></span>}
          {d.csFenqu && <span>{lang === "zh-CN" ? "陈邡分区" : "陳邡分區"}: <strong style={{ color: "var(--accent)" }}>{d.csFenqu}</strong></span>}
        </div>
      </div>

      {/* 行政层级 */}
      {(d.adminProvince || d.adminCity || d.adminCounty || d.adminTown) && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "行政层级" : "行政層級"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            {[d.adminProvince, d.adminCity, d.adminCounty, d.adminTown].filter(Boolean).join(" > ")}
          </div>
        </div>
      )}

      {/* 声调系统 */}
      {d.toneSystem && (() => {
        try {
          const tones = JSON.parse(d.toneSystem);
          const entries = Object.entries(tones).slice(0, 8);
          if (entries.length === 0) return null;
  // CJK / IME synthetic points — show sample words
  const isCJKSynth = d.id.startsWith("__cjk__");
  if (isCJKSynth && d.sampleWords && d.sampleWords.length > 0) {
    return (
      <div key={d.id}>
        <div className="drawer-headline">{d.title || d.name}</div>
        <div className="drawer-group" style={{ marginBottom: 16 }}>
          <span className="drawer-group__dot" style={{ background: d.markerColor || getBroadColor(d.broad) }} />
          <span className="drawer-group__label" style={{ color: getBroadColor(d.broad) }}>{d.location || d.broad}</span>
        </div>
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "读音" : "讀音"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.sampleWords.map((sw: any, i: number) => (
              <div key={i} style={{
                padding: "8px 12px", background: "var(--bg-overlay)", borderRadius: 6,
                fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)",
              }}>
                <span style={{ fontFamily: "var(--font-han)", fontSize: 16, marginRight: 8 }}>{sw.concept || sw.conceptZh}</span>
                {sw.ipa}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
            <div className="drawer-section">
              <div className="drawer-section__title">{lang === "zh-CN" ? "声调系统" : "聲調系統"}</div>
              <table style={{ fontSize: 11, color: "var(--text-secondary)", width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
          <th style={{ padding: "3px 6px", textAlign: "left", fontWeight: 600 }}>{lang === "zh-CN" ? "调号" : "調號"}</th>
          <th style={{ padding: "3px 6px", textAlign: "left", fontWeight: 600 }}>{lang === "zh-CN" ? "调值" : "調值"}</th>
          <th style={{ padding: "3px 6px", textAlign: "left", fontWeight: 600 }}>{lang === "zh-CN" ? "调名" : "調名"}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([num, val]: [string, any]) => (
                    <tr key={num} style={{ borderBottom: "0.5px solid var(--border-subtle)" }}>
                      <td style={{ padding: "2px 6px" }}>{num}</td>
                      <td style={{ padding: "2px 6px", fontFamily: "var(--font-serif)", color: "var(--accent)" }}>{val[0]}</td>
                      <td style={{ padding: "2px 6px" }}>{val[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } catch { return null; }
      })()}

      {/* 参考文献 */}
      {d.references && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "参考文献" : "參考文獻"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.references}</div>
        </div>
      )}

      {/* 说明 */}
      {d.extraNotes && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "说明" : "說明"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.extraNotes}</div>
        </div>
      )}

      {/* Location */}
      {d.location && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "具体地点" : "具體地點"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.location}</div>
        </div>
      )}

      {/* Source */}
      {d.source && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "数据信息" : "數據信息"}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {d.source.replace(/<[^>]*>/g, "").slice(0, 80)}
          </div>
        </div>
      )}

      {/* Coordinate */}
      <div className="drawer-section">
        <div className="drawer-section__title">{lang === "zh-CN" ? "坐标" : "座標"}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {d.lat?.toFixed(4) ?? "—"}°, {d.lng?.toFixed(4) ?? "—"}°
        </div>
      </div>

      {/* Nearest dialects */}
      {nearest.length > 0 && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? "邻近方言" : "鄰近方言"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {nearest.map((n, i) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "var(--bg-overlay)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--text-tertiary)", minWidth: 16, textAlign: "right" }}>
                  {i + 1}
                </span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: getBroadColor(n.broad),
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "var(--text)", flex: 1 }}>{n.title || n.name}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                  {(n.dist * 110).toFixed(0)} km
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broad category stats */}
      {points && (
        <div className="drawer-section">
          <div className="drawer-section__title">{lang === "zh-CN" ? `${d.broad} 类统计` : `${d.broad} 類統計`}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            共 {points.filter((p) => p.broad === d.broad).length} 个方言点 · 涵盖{" "}
            {new Set(points.filter((p) => p.broad === d.broad).map((p) => p.region)).size} 个方言区
          </div>
        </div>
      )}
    </div>
  );
}

export function InfoDrawer() {
  const sel = useAppStore((s) => s.selectedDialect);
  const setSel = useAppStore((s) => s.selectDialect);
  const compareDialect = useAppStore((s) => s.compareDialect);
  const setCompare = useAppStore((s) => s.setCompareDialect);
  const lang = useAppStore((s) => s.lang);
  const close = useCallback(() => {
    setSel(null);
    setCompare(null);
  }, [setSel, setCompare]);

  if (!sel) return null;

  return (
    <>
      <div className={`drawer ${sel ? "drawer--open" : ""}`}>
        <div className="drawer__close">
          <button
            className="drawer__close-btn"
            onClick={close}
            aria-label={t("close", lang)}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">
          <DialectInfo />
        </div>
      </div>
    </>
  );
}
