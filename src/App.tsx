import { useEffect, Suspense, lazy, useState } from "react";
import { useAppStore, VIEWS, VIEW_GROUPS } from "@/store/useAppStore";
import { CoverPage } from "@/components/CoverPage";
import { InfoDrawer } from "@/components/InfoDrawer";
import { ShareCard } from "@/components/ShareCard";
import { GuideModal } from "@/components/GuideModal";
import { GuideDrawer } from "@/components/GuideDrawer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorScreen } from "@/components/ErrorScreen";
import { TabsView } from "@/components/TabsView";
import { PresentationShell } from "@/components/PresentationShell";
import type { ViewName } from "@/types";

const PlaceholderView = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: 16 }}>
    即将上线 · Coming Soon
  </div>
);

const MapView = lazy(() => import("@/components/MapView").then((m) => ({ default: m.MapView })));
const TreeView = lazy(() => import("@/components/TreeView").then((m) => ({ default: m.TreeView })));
const ScatterView = lazy(() => import("@/components/ScatterView").then((m) => ({ default: m.ScatterView })));
const MatrixView = lazy(() => import("@/components/MatrixView").then((m) => ({ default: m.MatrixView })));
const CharQueryView = lazy(() => import("@/components/CharQueryView").then((m) => ({ default: m.CharQueryView })));
const ZoneStatsView = lazy(() => import("@/components/ZoneStatsView").then((m) => ({ default: m.ZoneStatsView })));
const ComponentSearchView = lazy(() => import("@/components/ComponentSearchView").then((m) => ({ default: m.ComponentSearchView })));
const HistoryView = lazy(() => import("@/components/HistoryView").then((m) => ({ default: m.HistoryView })));
const SankeyView = lazy(() => import("@/components/SankeyView").then((m) => ({ default: m.SankeyView })));
const ParallelView = lazy(() => import("@/components/ParallelView").then((m) => ({ default: m.ParallelView })));
const ChordView = lazy(() => import("@/components/ChordView").then((m) => ({ default: m.ChordView })));
const CoverageMatrixView = lazy(() => import("@/components/CoverageMatrixView").then((m) => ({ default: m.CoverageMatrixView })));
const NushuView = lazy(() => import("@/components/NushuView").then((m) => ({ default: m.NushuView })));
const CJKView = lazy(() => import("@/components/CJKView").then((m) => ({ default: m.CJKView })));
const IMEView = lazy(() => import("@/components/IMEView").then((m) => ({ default: m.IMEView })));
const ToneCurveView = lazy(() => import("@/components/ToneCurveView").then((m) => ({ default: m.ToneCurveView })));
const DialectCharView = lazy(() => import("@/components/DialectCharView").then((m) => ({ default: m.DialectCharView })));
const PhonoView = lazy(() => import("@/components/PhonoView").then((m) => ({ default: m.PhonoView })));
const ClusterView = lazy(() => import("@/components/ClusterView").then((m) => ({ default: m.ClusterView })));

const ALL_COMPONENTS: Record<ViewName, React.ComponentType> = {
  map: MapView, tree: TreeView, scatter: ScatterView,
  matrix: MatrixView, charquery: CharQueryView, zonestats: ZoneStatsView,
  compsearch: ComponentSearchView, history: HistoryView,
  sankey: SankeyView, parallel: ParallelView,
  chord: ChordView, coverage: CoverageMatrixView, nushu: NushuView, cjk: CJKView, ime: IMEView,
  treemap: TreeView, ridge: ParallelView, tonecurve: ToneCurveView, dialectchar: DialectCharView,
  phono: PhonoView, cluster: ClusterView, ling: ScatterView,
};

const TITLES_ZH: Record<ViewName, string> = {
  map: "方言地理分布", scatter: "方言距离", zonestats: "区域统计",
  tree: "方言分类谱系", matrix: "历史音韵分析", charquery: "汉字读音查询",
  compsearch: "字符探源", history: "历史音变",   sankey: "音韵流图",
  parallel: "音系对比", ridge: "山脊图", chord: "亲疏关系",
  coverage: "音韵覆盖", nushu: "江永女书", cjk: "汉日韩越", ime: "编码透视",
  treemap: "矩形树图", tonecurve: "声调曲线", dialectchar: "特征文字",
  phono: "拟音对比", cluster: "层次聚类", ling: "语音距离",
};

const TITLES_TW: Record<ViewName, string> = {
  map: "方言地理分佈", scatter: "方言距離", zonestats: "區域統計",
  tree: "方言分類譜系", matrix: "歷史音韻分析", charquery: "漢字讀音查詢",
  compsearch: "字符探源", history: "歷史音變",   sankey: "音韻流圖",
  parallel: "音系對比", ridge: "山脊圖", chord: "親疏關係",
  coverage: "音韻覆蓋", nushu: "江永女書", cjk: "漢日韓越", ime: "編碼透視",
  treemap: "矩形樹圖", tonecurve: "聲調曲線", dialectchar: "特徵文字",
  phono: "擬音對比", cluster: "層次聚類", ling: "語音距離",
};

export default function App() {
  const coverPassed = useAppStore((s) => s.coverPassed);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const lang = useAppStore((s) => s.lang);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const setData = useAppStore((s) => s.setData);
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const tabView = useAppStore((s) => s.tabView);
  const setTabView = useAppStore((s) => s.setTabView);
  const selectedDialect = useAppStore((s) => s.selectedDialect);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const fontStyle = useAppStore((s) => s.fontStyle);
  const setFontStyle = useAppStore((s) => s.setFontStyle);
  const mdsSource = useAppStore((s) => s.mdsSource);
  const setMdsSource = useAppStore((s) => s.setMdsSource);
  const childSelected = useAppStore((s) => s.childSelected);
  const setLang = useAppStore((s) => s.setLang);
  const treeMode = useAppStore((s) => s.treeMode);
  const subMode = useAppStore((s) => s.subMode);
  const guideOpen = useAppStore((s) => s.guideOpen);
  const setGuideOpen = useAppStore((s) => s.setGuideOpen);
  const selectDialect = useAppStore((s) => s.selectDialect);
  const resetCoverPage = useAppStore((s) => s.resetCoverPage);
  const isPresentationMode = useAppStore((s) => s.isPresentationMode);
  const enterPresentation = useAppStore((s) => s.enterPresentation);

  // Mutual exclusion: guide drawer and dialect drawer can't both be open
  useEffect(() => {
    if (guideOpen && selectedDialect) selectDialect(null);
  }, [guideOpen]);
  useEffect(() => {
    if (selectedDialect && guideOpen) setGuideOpen(false);
  }, [selectedDialect]);
  const [brandIconMode, setBrandIconMode] = useState<"han" | "svg">("svg");
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let wasMobile = window.innerWidth <= 768;
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile === wasMobile) return;
      wasMobile = isMobile;
      setCollapsed(isMobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const GROUP_TW: Record<string, string> = {
    "空间格局": "空間格局",
    "分类结构": "分類結構",
    "音韵结构": "音韻結構",
    "工具检索": "工具檢索",
  };

  function toggleGroup(g: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  }

  function getHeaderTitle(): string {
    const titles = lang === "zh-CN" ? TITLES_ZH : TITLES_TW;
    return titles[tabView] ?? titles[currentView] ?? "";
  }

  function resolveGuideId(view: ViewName, tab: ViewName, sub: string): string {
    if (view === "tree") return treeMode === "radial" ? "tree" : "treemap";
    if (tab === "matrix") return "phonology";
    if (tab === "coverage") return "coverage";
    if (tab === "charquery" && sub === "dict") return "dictcompare";
    if (tab === "history") return "history";
    if (tab === "sankey") return "sankey";
    if (tab === "parallel" && sub === "ridge") return "ridge";
    if (tab === "parallel") return "parallel";
    if (tab === "ridge") return "ridge";
    if (tab === "nushu") return "nushu";
    if (tab === "cjk") return "cjk";
    if (tab === "ime") return "ime";
    if (tab === "treemap") return "treemap";
    if (tab === "tonecurve") return "tonecurve";
    if (tab === "dialectchar") return "dialectchar";
    return view;
  }

  useEffect(() => {
    const DATA_FILES: Record<string, string> = {
      dialects: "/data/dialects.json",
      charReadings: "/data/char_readings.json",
      mcPhonology: "/data/mc_phonology.json",
      ocPhonology: "/data/oc_phonology.json",
      mdsCoords: "/data/mds_coords.json",
      china: "/data/china.json",
    };
    Promise.all(
      Object.entries(DATA_FILES).map(async ([key, url]) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`${key}: HTTP ${resp.status}`);
        const json = await resp.json();
        return { key, data: json };
      })
    )
      .then((results) => {
        for (const { key, data } of results) setData(key as keyof typeof DATA_FILES as any, data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const state = useAppStore.getState();
      if (state.isPresentationMode) return;
      if (e.key === "Escape") {
        if (state.selectedDialect) { state.selectDialect(null); return; }
      }
      // Arrow keys cycle through parent views (groups)
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const flat = VIEWS.flatMap((v) => (v.children ? v.children.map((c) => ({ parent: v.id, id: c.id })) : [{ parent: v.id, id: v.id }]));
        const idx = flat.findIndex((f) => f.id === state.tabView);
        if (idx === -1) return;
        const next = e.key === "ArrowDown" ? (idx + 1) % flat.length : (idx - 1 + flat.length) % flat.length;
        const nextItem = flat[next];
        if (nextItem.parent === nextItem.id) {
          setView(nextItem.id);
        } else {
          setView(nextItem.parent);
          setTabView(nextItem.id);
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        // Within merged views: cycle tabs; outside: tree mode toggle
        const vdef = VIEWS.find((v) => v.id === state.currentView);
        if (vdef?.children) {
          const tabs = vdef.children;
          const idx = tabs.findIndex((t) => t.id === state.tabView);
          const next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
          setTabView(tabs[next].id);
        } else if (state.currentView === "tree") {
          state.setTreeMode(state.treeMode === "radial" ? "treemap" : "radial");
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleFont = () => setFontStyle(fontStyle === "sans" ? "serif" : "sans");
  const toggleLang = () => setLang(lang === "zh-CN" ? "zh-TW" : "zh-CN");

  const renderView = () => {
    if (loading) return <LoadingScreen />;
    if (error) return <ErrorScreen message={error} />;

    const vdef = VIEWS.find((v) => v.id === currentView);
    if (!vdef) return <LoadingScreen />;

    // Merged view: render TabsView with children components
    if (vdef.children) {
      const childComps: Record<string, React.ComponentType> = {};
      for (const c of vdef.children) {
        childComps[c.id] = ALL_COMPONENTS[c.id] ?? PlaceholderView;
      }
      return <TabsView>{childComps}</TabsView>;
    }

    // Standalone view
    const View = ALL_COMPONENTS[currentView];
    if (!View) return <LoadingScreen />;
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <View />
        </ErrorBoundary>
      </Suspense>
    );
  };

  const currentViewDef = VIEWS.find((v) => v.id === currentView);
  const hasTabs = currentViewDef?.children && currentViewDef.children.length > 1;
  const activeGuideId = resolveGuideId(currentView, tabView, subMode);

  if (coverPassed && isPresentationMode) {
    return <PresentationShell renderView={renderView} />;
  }

  return (
    <>
      {!coverPassed ? <CoverPage /> : (
      <div className="app-shell">
        <button className="sidebar-mobile-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Menu">
          {collapsed ? "\u2630" : "\u2715"}
        </button>
        <div className={`sidebar-backdrop ${!collapsed ? "sidebar-backdrop--open" : ""}`} onClick={() => setCollapsed(true)} />
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
          <div className="sidebar-brand">
            <span
              className="brand-icon"
              style={{ cursor: "pointer" }}
              onClick={() => setBrandIconMode(brandIconMode === "han" ? "svg" : "han")}
              onDoubleClick={resetCoverPage}
            >
              {brandIconMode === "han" ? "漢" : <img src="/favicon.svg" style={{ width: 24, height: 24, verticalAlign: "middle" }} alt="" />}
            </span>
            {!collapsed && <div className="brand-text" style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}><span className="brand-title">語疆</span><span className="brand-subtitle">Lingvo Territory</span></div>}
          </div>

          <nav className="sidebar-nav">
            {VIEW_GROUPS.map((group) => {
              const groupViews = VIEWS.filter((v) => v.group === group);
              if (groupViews.length === 0) return null;
              const isCollapsed = collapsedGroups.has(group);

              return (
                <div key={group} className="sidebar-group">
                  <button
                    className="sidebar-group-header"
                    onClick={() => toggleGroup(group)}
                    title={isCollapsed ? "展开" : "折叠"}
                  >
                    {!collapsed && <span className="group-label">{lang === "zh-CN" ? group : (GROUP_TW[group] || group)}</span>}
                    <span className="group-arrow">{isCollapsed ? "▸" : "▾"}</span>
                  </button>

                  {!isCollapsed && groupViews.map((v) => {
                    const isActive = currentView === v.id;
                    const hasChildren = v.children && v.children.length > 0;
                    return (
                      <div key={v.id}>
                        <button
                          className={`sidebar-item ${isActive ? "active" : ""}`}
                          onClick={() => {
                            if (isActive) return;
                            setCollapsedGroups((prev) => {
                              const next = new Set(prev);
                              next.delete(group);
                              return next;
                            });
                            setView(v.id);
                          }}
                          title={lang === "zh-CN" ? v.labelZh : v.labelTw}
                        >
                          <span className="item-emoji" style={v.id === "charquery" ? { fontFamily: "\"汇文明朝体\", WenjinMincho, var(--font-han)" } : (v.emoji.length > 1 && v.emoji.codePointAt(0)! > 0xFFFF ? { fontFamily: "var(--font-nushu), var(--font-serif), serif" } : undefined)}>{v.emoji}</span>
                          {!collapsed && <span className="item-label">{lang === "zh-CN" ? v.labelZh : v.labelTw}</span>}
                        </button>
                        {hasChildren && isActive && !collapsed && (
                          <div className="sidebar-subitems">
                            {v.children!.map((child) => (
                              <button
                                key={child.id}
                                className={`sidebar-item sidebar-subitem ${tabView === child.id && (currentView !== "matrix" || childSelected) ? "active" : ""}`}
                                onClick={() => setTabView(child.id)}
                                title={lang === "zh-CN" ? child.labelZh : child.labelTw}
                              >
                                <span className="item-emoji" style={child.id === "nushu" ? { fontFamily: "var(--font-nushu), var(--font-serif), serif" } : (child.emoji === "geo" || child.emoji === "vol") ? { fontFamily: "ArkPixel, monospace", fontWeight: 400, fontSize: 10, color: (tabView === child.id && (currentView !== "matrix" || childSelected)) ? "var(--accent)" : "var(--text-tertiary)", WebkitFontSmoothing: "none" } : undefined}>{child.emoji === "geo" ? "GEO" : child.emoji === "vol" ? "VOL" : child.emoji}</span>
                                <span className="item-label">{lang === "zh-CN" ? child.labelZh : child.labelTw}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-settings">
              {!collapsed && (
                <>
                <div className="settings-inline">
                  <button onClick={toggleTheme} className="settings-row-btn">
                    {lang === "zh-CN" ? (theme === "dark" ? "暗色" : "亮色") : (theme === "dark" ? "暗色" : "亮色")}
                  </button>
                  <button onClick={toggleFont} className="settings-row-btn">
                    {lang === "zh-CN" ? (fontStyle === "sans" ? "无衬线" : "衬线") : (fontStyle === "sans" ? "無襯線" : "襯線")}
                  </button>
                </div>
                <div className="settings-inline">
                  <button onClick={toggleLang} className="settings-row-btn">
                    {lang === "zh-CN" ? "简中" : "繁中"}
                  </button>
                  <button onClick={enterPresentation} className="settings-row-btn">
                    Slides
                  </button>
                </div>
                <div className="settings-inline">
                  <button onClick={() => setCollapsed(true)} className="settings-row-btn">
                    {"收起"}
                  </button>
                </div>
                </>
              )}
              {collapsed && (
                <button onClick={() => setCollapsed(false)} className="settings-row-btn" style={{ width: "100%" }}>
                  ▸
                </button>
              )}

          </div>
        </aside>

        <main className="view-panel" style={{ marginRight: (selectedDialect || guideOpen) ? 400 : 0, transition: 'margin-right 0.3s ease' }}>
          <header className="view-header" onClick={() => { if (selectedDialect) selectDialect(null); }} style={selectedDialect ? { cursor: "pointer" } : undefined}>
            <div className="view-heading">
              <div className="view-heading__kicker">
                {lang === "zh-CN" ? currentViewDef?.group : GROUP_TW[currentViewDef?.group || ""] || currentViewDef?.group}
              </div>
              <div className="view-heading__row">
                <h1>{getHeaderTitle()}</h1>
                {hasTabs && (
                  <nav className="header-tabs">
                    {currentViewDef!.children!.map((child) => (
                      <button
                        key={child.id}
                        className={`header-tabs__item ${tabView === child.id ? "active" : ""}`}
                        onClick={() => setTabView(child.id)}
                      >
                        <span style={child.id === "charquery" ? { fontFamily: "\"汇文明朝体\", WenjinMincho, var(--font-han)" } : (child.emoji === "geo" || child.emoji === "vol") ? { fontFamily: "ArkPixel, monospace", fontWeight: 400, WebkitFontSmoothing: "none" } : { fontFamily: "var(--font-nushu), var(--font-serif), serif" }}>{child.emoji}</span> {lang === "zh-CN" ? child.labelZh : child.labelTw}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            </div>
            <div className="view-header__guide">
              <GuideModal guideId={activeGuideId} />
            </div>
          </header>
          <div className="view-content">{renderView()}</div>
        </main>

        <ErrorBoundary>
          <InfoDrawer />
        </ErrorBoundary>
        {guideOpen && (
          <GuideDrawer guideId={resolveGuideId(currentView, tabView, subMode)} />
        )}
        <ShareCard />
      </div>
      )}
    </>
  );
}
