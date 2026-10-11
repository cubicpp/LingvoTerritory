/**
 * ComponentSearchView.tsx — 字符探源·部件检索
 * Virtual scrolling: renders batches of 200, loads more via IntersectionObserver.
 * Click component → opens InfoDrawer with character list.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useAppStore } from "@/store/useAppStore"

type ComponentMap = Record<string, string[]>

const BATCH = 300

export function ComponentSearchView() {
  const lang = useAppStore((s) => s.lang)
  const selectDialect = useAppStore((s) => s.selectDialect)
  const [compMap, setCompMap] = useState<ComponentMap | null>(null)
  const [idsData, setIdsData] = useState<{ charIds: Record<string, string>; compMap: Record<string, string[]> } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [visible, setVisible] = useState(BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/data/component_map.json").then(r => r.json()),
      fetch("/data/ids_component.json").then(r => r.json()),
    ])
      .then(([comp, ids]) => { setCompMap(comp); setIdsData(ids) })
      .catch(() => setLoadError(true))
  }, [])

  const sortedComps = useMemo(() => {
    if (!compMap) return [] as [string, number][]
    return Object.entries(compMap)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([k, v]) => [k, v.length] as [string, number])
  }, [compMap])

  const filteredComps = useMemo(() => {
    if (!search) return sortedComps
    return sortedComps.filter(([k]) => k === search)
  }, [sortedComps, search])

  const visibleComps = useMemo(() => filteredComps.slice(0, visible), [filteredComps, visible])
  const hasMore = visible < filteredComps.length

  // Reset visible when search or data changes
  useEffect(() => { setVisible(BATCH) }, [filteredComps.length])

  // IntersectionObserver for the sentinel
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(v => Math.min(v + BATCH, filteredComps.length))
      }
    }, { root: containerRef.current, rootMargin: "200px" })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, filteredComps.length])

  const handleCompClick = useCallback((comp: string) => {
    setSelected(comp)
    const chars = compMap?.[comp] || []
    selectDialect({
      id: `__comp__${comp}`,
      name: comp, title: `部件 ${comp}`,
      lat: 0, lng: 0,
      region: "", group: "", subgroup: "",
      broad: "未分类" as any, color: "", symbol: "",
      ydFenqu: "", csFenqu: "", source: "", contributor: "",
      location: "", markerColor: "",
      groupMembers: chars.map((c: string) => ({
        id: `__compchar__${c}`, name: c, title: c,
        lat: 0, lng: 0, region: "", group: "", subgroup: "",
        broad: "未分类" as any, color: "", symbol: "",
        ydFenqu: "", csFenqu: "", source: "", contributor: "",
        location: idsData?.charIds?.[c] ? idsData.charIds[c] : "", markerColor: "",
      })) as any,
      _idsData: idsData,
    } as any)
  }, [compMap, idsData, selectDialect])

  if (loadError) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
          {lang === "zh-CN" ? "加载部件数据失败，请刷新重试" : "加載部件數據失敗，請刷新重試"}
        </span>
      </div>
    )
  }

  if (!compMap) {
    return (
      <div className="loading-screen">
        <div className="loading-blob" />
        <span className="loading-label">{lang === "zh-CN" ? "加载部件数据..." : "加載部件數據..."}</span>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      <style>{`
        .comp-grid-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px 4px 4px; border-radius: var(--radius-md);
          border: 0.5px solid var(--border-subtle); background: var(--glass-2);
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .comp-grid-btn:hover { background: var(--glass-3); }
        .comp-grid-btn.sel { border: 1px solid var(--accent); background: var(--accent-subtle); }
        .comp-grid-btn .comp-char {
          font-size: 22px; font-family: var(--font-serif); color: var(--text); line-height: 1.3;
        }
        .comp-grid-btn .comp-count {
          font-size: 10px; color: var(--text-tertiary); margin-top: 2px;
        }
      `}</style>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: "0.5px solid var(--border-subtle)", flexShrink: 0 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--glass-2)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "0.5px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "6px 12px", flex: 1 }}>
          <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}>&#x1F50D;</span>
          <input type="text" placeholder={lang === "zh-CN" ? "检索部件..." : "檢索部件..."} value={search}
            onChange={(e) => setSearch(e.target.value.slice(0, 1))}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 14 }}
          />
        </label>
        {selected && (
          <span style={{ fontSize: 20, fontFamily: "var(--font-serif)", color: "var(--accent)" }}>{selected}</span>
        )}
      </div>
      <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: 6, alignContent: "flex-start" }}>
        {visibleComps.map(([comp, count]) => (
          <button key={comp} className={`comp-grid-btn${selected === comp ? " sel" : ""}`}
            onClick={() => handleCompClick(comp)}
            title={`${comp} (${count} ${lang === "zh-CN" ? "字" : "字"})`}>
            <span className="comp-char">{comp}</span>
            <span className="comp-count">{count}</span>
          </button>
        ))}
        {/* Sentinel for infinite scroll */}
        {hasMore && <div ref={sentinelRef} style={{ gridColumn: "1 / -1", textAlign: "center", padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>
          {lang === "zh-CN" ? `加载中… (${visible}/${filteredComps.length})` : `加載中… (${visible}/${filteredComps.length})`}
        </div>}
        {filteredComps.length === 0 && search && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-tertiary)", fontSize: 14, padding: 40 }}>
            {lang === "zh-CN" ? `未找到部件 "${search}"` : `未找到部件 "${search}"`}
          </div>
        )}
      </div>
    </div>
  )
}
