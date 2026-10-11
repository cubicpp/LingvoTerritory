/**
 * ZoneStatsView.tsx — 区域统计（音典分區柱状图）
 * Pure React bars, click → InfoDrawer zone member list
 * Top-right button → top char-count dialect points in InfoDrawer
 */
import { useMemo, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

const ZONE_COLORS = [
  "#c43a31", "#4a7c59", "#d4926a", "#e8b44a", "#7b9e6d",
  "#8e6b4f", "#6b8e8a", "#c08060", "#a09080", "#b0a080",
  "#6080a0", "#80a060", "#9a6a8e", "#6a9a9e", "#c08080",
  "#80c080", "#8080c0", "#c0c080", "#c080c0", "#80c0c0",
  "#a04040", "#40a040", "#4040a0", "#a0a040", "#a040a0",
];

function getYdZone(ydFenqu: string): string {
  if (!ydFenqu) return "未分类";
  const idx = ydFenqu.indexOf("－");
  if (idx === -1) return ydFenqu;
  return ydFenqu.slice(0, idx);
}

export function ZoneStatsView() {
  const dialects = useAppStore((s) => s.dataCache.dialects);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const selected = useAppStore((s) => s.selectedDialect);
  const lang = useAppStore((s) => s.lang);
  const [charCoverage, setCharCoverage] = useState<{ name: string; count: number; id: string }[]>([]);

  useEffect(() => {
    fetch("/data/dialect_readings.json")
      .then(r => r.json())
      .then(data => {
        const counts = new Map<string, { name: string; count: number }>();
        for (const items of Object.values(data.charIndex || {}) as any) {
          for (const item of (items as any[])) {
            const key = item.pointId || item.pointName;
            if (!counts.has(key)) counts.set(key, { name: item.pointName || key, count: 0 });
            const entry = counts.get(key)!;
            entry.count++;
          }
        }
        const sorted = Array.from(counts.entries())
          .map(([id, v]) => ({ id, name: v.name, count: v.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
        setCharCoverage(sorted);
      })
      .catch(() => {});
  }, []);

  const zoneStats = useMemo(() => {
    if (!dialects) return [];
    const map = new Map<string, number>();
    for (const p of dialects.points) {
      const zone = getYdZone(p.ydFenqu);
      map.set(zone, (map.get(zone) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [dialects]);

  const handleTopCharsClick = () => {
    if (charCoverage.length === 0 || !dialects) return;
    const members = charCoverage
      .map((d) => dialects.points.find((p) => p.id === d.id || p.title === d.name))
      .filter(Boolean) as typeof dialects.points;
    // fallback for unmatched items
    for (const d of charCoverage) {
      if (!members.find((m) => m.id === d.id || m.title === d.name)) {
        members.push({
          id: d.id,
          name: d.name,
          title: d.name,
          lat: 0, lng: 0,
          region: "", group: "", subgroup: "",
          broad: "未分类" as any,
          color: "#a0a0a0",
          symbol: "",
          ydFenqu: "", csFenqu: "",
          source: "", contributor: "", location: "", markerColor: "",
        });
      }
    }
    const sp = {
      id: `__group__topchars`,
      name: "收录字最多方言点",
      title: `${lang === "zh-CN" ? "收录字最多方言点" : "收錄字最多方言點"} (Top ${members.length})`,
      lat: 0, lng: 0,
      region: "", group: "", subgroup: "",
      broad: "官话" as any,
      color: "#c43a31",
      symbol: "", ydFenqu: "", csFenqu: "",
      source: "", contributor: "", location: "", markerColor: "",
      groupMembers: members,
    } as any;
    selectDialect(sp);
  };

  const isTopCharsActive = selected?.id === "__group__topchars";

  if (!dialects) {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span>{lang === "zh-CN" ? "加载数据..." : "載入資料..."}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 16px", position: "relative" }}>
      {/* Top-right button */}
      {charCoverage.length > 0 && (
        <button
          onClick={handleTopCharsClick}
          style={{
            position: "absolute", top: 12, right: 16, zIndex: 1,
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 8,
            fontSize: 12, fontWeight: 500,
            color: isTopCharsActive ? "var(--accent)" : "var(--text-tertiary)",
            background: isTopCharsActive ? "var(--accent-subtle)" : "var(--glass-2)",
            border: `0.5px solid ${isTopCharsActive ? "var(--accent-subtle)" : "var(--border-subtle)"}`,
            cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.2s var(--ease)",
          }}
          title={lang === "zh-CN" ? "查看收录字最多的方言点" : "查看收錄字最多的方言點"}
        >
          <span>📋</span>
          {lang === "zh-CN" ? "收录字最多" : "收錄字最多"} ({charCoverage.length})
        </button>
      )}

      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
         {lang === "zh-CN" ? `共 ${dialects.totalPoints} 个采样点 · ${zoneStats.length} 个分区` : `共 ${dialects.totalPoints} 個採樣點 · ${zoneStats.length} 個分區`}
      </div>
      {zoneStats.length === 0 ? (
        <div>{lang === "zh-CN" ? "暂无区域统计数据" : "暫無區域統計數據"}</div>
      ) : (
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {zoneStats.map(([zone, count], i) => {
            const maxCount = zoneStats[0][1];
            const pct = (count / maxCount) * 100;
            return (
              <div
                key={zone}
                onClick={() => {
                  const zoneMembers = dialects.points.filter((p) => getYdZone(p.ydFenqu) === zone);
                  const first = zoneMembers[0];
                  const sp = {
                    id: `__group__zone_${zone}`,
                    name: zone, title: zone,
                    lat: 0, lng: 0,
                    region: "", group: "", subgroup: "",
                    broad: (first?.broad || "官话") as any,
                    color: ZONE_COLORS[i % ZONE_COLORS.length],
                    symbol: "", ydFenqu: "", csFenqu: "",
                    source: "", contributor: "", location: "", markerColor: "",
                    groupMembers: zoneMembers,
                  } as any;
                  selectDialect(sp);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                  background: "transparent",
                }}
              >
                <span style={{ width: 80, fontSize: 12, color: "var(--text)", textAlign: "right", flexShrink: 0 }}>
                  {zone}
                </span>
                <div style={{ flex: 1, height: 18, background: "var(--bg-overlay)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 4,
                    background: ZONE_COLORS[i % ZONE_COLORS.length],
                    minWidth: pct > 0 ? 4 : 0,
                    transition: "width 0.3s var(--ease)",
                  }} />
                </div>
                <span style={{ width: 36, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
