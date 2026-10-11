/**
 * useAppStore.ts — Zustand global state (v5, grouped sidebar + merged views)
 */
import { create } from "zustand";
import type { ViewName, DataCache, DialectPoint, BroadCategory } from "@/types";

// ─── Constants ───
export type Theme = "light" | "dark";
export type FontStyle = "sans" | "serif";
export type FontSize = "standard" | "large";
export type Lang = "zh-CN" | "zh-TW";
export interface PresentationToolbarPosition {
  x: number;
  y: number;
}

export const BROAD_COLORS: Record<string, string> = {
  "官话": "#b83f37", "吴语": "#2f806e", "粤语": "#c47535",
  "闽语": "#d2a12d", "客家话": "#6f8f3d", "湘语": "#8b5d91",
  "赣语": "#3d70a8", "晋语": "#a8662e", "徽语": "#6c69a3",
  "平话土话": "#9b7b3f", "标准语": "#2b2720",
  "乡话": "#5c8d9a", "戏曲音": "#c45f82",
  "域外方音": "#4d8fbd", "民族语": "#5d9954",
  "未分类": "#9a9a9a",
};

// ─── View definitions (v5: merged + children) ───
export interface TabDef {
  id: ViewName;
  labelZh: string;
  labelTw: string;
  emoji: string;
}
export interface ViewDef {
  id: ViewName;
  labelZh: string;
  labelTw: string;
  group: string;
  shortcut: string;
  emoji: string;
  children?: TabDef[];
}

export const VIEWS: ViewDef[] = [
  { id: "map", labelZh: "地理分布", labelTw: "地理分佈", group: "空间格局", shortcut: "1", emoji: "🗺️" },
  { id: "zonestats", labelZh: "区域统计", labelTw: "區域統計", group: "空间格局", shortcut: "2", emoji: "📊" },
  {
    id: "scatter", labelZh: "方言距离", labelTw: "方言距離", group: "空间格局", shortcut: "3", emoji: "🫧",
    children: [
      { id: "scatter", labelZh: "地理距离", labelTw: "地理距離", emoji: "geo" },
      { id: "ling", labelZh: "语音距离", labelTw: "語音距離", emoji: "vol" },
    ],
  },
  {
    id: "tree", labelZh: "分类谱系", labelTw: "分類譜系", group: "分类结构", shortcut: "4", emoji: "🌳",
    children: [
      { id: "tree", labelZh: "谱系树", labelTw: "譜系樹", emoji: "🌿" },
      { id: "treemap", labelZh: "矩形树", labelTw: "矩形樹", emoji: "🗂️" },
    ],
  },
  { id: "cluster", labelZh: "层次聚类", labelTw: "層次聚類", group: "分类结构", shortcut: "5", emoji: "🧬" },
  { id: "chord", labelZh: "亲疏关系", labelTw: "親疏關係", group: "分类结构", shortcut: "6", emoji: "🕸️" },
  { id: "dialectchar", labelZh: "特征文字", labelTw: "特徵文字", group: "工具检索", shortcut: "7", emoji: "📝" },
  {
    id: "charquery", labelZh: "汉字分析", labelTw: "漢字分析", group: "工具检索", shortcut: "8", emoji: "漢",
    children: [
      { id: "charquery", labelZh: "读音查询", labelTw: "讀音查詢", emoji: "🔍" },
      { id: "history", labelZh: "历史演变", labelTw: "歷史演變", emoji: "⏳" },
      { id: "nushu", labelZh: "江永女书", labelTw: "江永女書", emoji: "𛆁" },
      { id: "cjk", labelZh: "汉日韩越", labelTw: "漢日韓越", emoji: "🌐" },
      { id: "ime", labelZh: "编码透视", labelTw: "編碼透視", emoji: "⌨️" },
      { id: "phono", labelZh: "拟音对比", labelTw: "擬音對比", emoji: "📜" },
    ],
  },
  { id: "compsearch", labelZh: "字符探源", labelTw: "字符探源", group: "工具检索", shortcut: "9", emoji: "🧩" },
  {
    id: "matrix", labelZh: "音韵分析", labelTw: "音韻分析", group: "音韵结构", shortcut: "0", emoji: "🔲",
    children: [
      { id: "matrix", labelZh: "音韵格局", labelTw: "音韻格局", emoji: "🔥" },
      { id: "coverage", labelZh: "音韵覆盖", labelTw: "音韻覆蓋", emoji: "📋" },
    ],
  },
  { id: "sankey", labelZh: "音韵流图", labelTw: "音韻流圖", group: "音韵结构", shortcut: "-", emoji: "🌊" },
  {
    id: "parallel", labelZh: "音系对比", labelTw: "音系對比", group: "音韵结构", shortcut: "=", emoji: "📐",
    children: [
      { id: "parallel", labelZh: "平行坐标", labelTw: "平行座標", emoji: "📈" },
      { id: "ridge", labelZh: "山脊图", labelTw: "山脊圖", emoji: "🏔️" },
    ],
  },
  { id: "tonecurve", labelZh: "声调曲线", labelTw: "聲調曲線", group: "音韵结构", shortcut: "[", emoji: "〰️" },
];

export const VIEW_GROUPS = ["空间格局", "分类结构", "音韵结构", "工具检索"] as const;

// ─── State ───
interface AppState {
  // Data
  dataCache: DataCache;
  setData: <K extends keyof DataCache>(key: K, data: DataCache[K]) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // View
  currentView: ViewName;
  setView: (view: ViewName) => void;
  tabView: ViewName;
  setTabView: (tab: ViewName) => void;
  treeMode: "radial" | "treemap";
  setTreeMode: (m: "radial" | "treemap") => void;
  subMode: string;
  setSubMode: (m: string) => void;
  childSelected: boolean;
  mdsSource: "geo" | "ling";
  setMdsSource: (s: "geo" | "ling") => void;

  // Selection
  selectedDialect: DialectPoint | null;
  selectDialect: (d: DialectPoint | null) => void;
  compareDialect: DialectPoint | null;
  setCompareDialect: (d: DialectPoint | null) => void;
  hoveredDialectId: string | null;
  hoverDialect: (id: string | null) => void;

  // UI
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontStyle: FontStyle;
  setFontStyle: (s: FontStyle) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  guideOpen: boolean;
  setGuideOpen: (v: boolean) => void;

  // Overlays
  radialOpen: boolean;
  toggleRadial: () => void;
  closeRadial: () => void;
  shareOpen: boolean;
  openShare: () => void;
  closeShare: () => void;

  // Cover page
  coverPassed: boolean;
  setCoverPassed: () => void;
  resetCoverPage: () => void;

  // Presentation mode
  isPresentationMode: boolean;
  currentSlideIndex: number;
  presentationReturnState: PresentationReturnState | null;
  presentationToolbarPosition: PresentationToolbarPosition;
  setPresentationToolbarPosition: (position: PresentationToolbarPosition) => void;
  enterPresentation: () => void;
  exitPresentation: () => void;
  goToSlide: (index: number) => void;
}

interface PresentationReturnState {
  currentView: ViewName;
  tabView: ViewName;
  treeMode: "radial" | "treemap";
  subMode: string;
  childSelected: boolean;
  mdsSource: "geo" | "ling";
  selectedDialect: DialectPoint | null;
  compareDialect: DialectPoint | null;
  hoveredDialectId: string | null;
  guideOpen: boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Data
  dataCache: {
    dialects: null,
    charReadings: null,
    mcPhonology: null,
    ocPhonology: null,
    mdsCoords: null,
    china: null,
  },
  setData: (key, data) =>
    set((s) => ({ dataCache: { ...s.dataCache, [key]: data } })),
  loading: true,
  setLoading: (v) => set({ loading: v }),
  error: null,
  setError: (e) => set({ error: e }),

  // View
  currentView: "map",
  setView: (view) => {
    const vdef = VIEWS.find((v) => v.id === view);
    const firstTab = vdef?.children?.[0]?.id ?? view;
    set({ currentView: view, tabView: firstTab, childSelected: false });
    if (firstTab === "treemap") set({ treeMode: "treemap" });
    else if (firstTab === "tree") set({ treeMode: "radial" });
    if (firstTab === "ling") set({ mdsSource: "ling" });
    else if (firstTab === "scatter") set({ mdsSource: "geo" });
  },
  childSelected: false,
  tabView: "map",
  setTabView: (tab) => {
    set({ tabView: tab, subMode: tab === "ridge" ? "ridge" : tab === "parallel" ? "parallel" : "", childSelected: true });
    set({ tabView: tab, subMode: tab === "ridge" ? "ridge" : tab === "parallel" ? "parallel" : "" });
    if (tab === "treemap") set({ treeMode: "treemap" });
    else if (tab === "tree") set({ treeMode: "radial" });
    if (tab === "ling") set({ mdsSource: "ling" });
    else if (tab === "scatter") set({ mdsSource: "geo" });
  },
  treeMode: "radial" as "radial" | "treemap",
  setTreeMode: (m) => set({ treeMode: m }),
  subMode: "",
  setSubMode: (m) => set({ subMode: m }),
  mdsSource: "geo" as "geo" | "ling",
  setMdsSource: (s) => set({ mdsSource: s }),

  // Selection
  selectedDialect: null,
  selectDialect: (d) => set({ selectedDialect: d }),
  compareDialect: null,
  setCompareDialect: (d) => set({ compareDialect: d }),
  hoveredDialectId: null,
  hoverDialect: (id) => set({ hoveredDialectId: id }),

  // UI
  theme: (localStorage.getItem("dialect-viz-theme") as Theme) || "dark",
  setTheme: (t) => {
    localStorage.setItem("dialect-viz-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    set({ theme: t });
  },
  fontStyle: (localStorage.getItem("dialect-viz-font") as FontStyle) || "serif",
  setFontStyle: (s) => {
    localStorage.setItem("dialect-viz-font", s);
    document.documentElement.setAttribute("data-font", s);
    set({ fontStyle: s });
  },
  fontSize: (localStorage.getItem("dialect-viz-fontsize") as FontSize) || "standard",
  setFontSize: (s) => {
    localStorage.setItem("dialect-viz-fontsize", s);
    document.documentElement.setAttribute("data-font-size", s);
    set({ fontSize: s });
  },
  lang: (localStorage.getItem("dialect-viz-lang") as Lang) || "zh-TW",
  setLang: (l) => {
    localStorage.setItem("dialect-viz-lang", l);
    document.documentElement.setAttribute("data-lang", l);
    set({ lang: l });
  },
  reducedMotion: false,
  toggleReducedMotion: () => set((s) => {
    const next = !s.reducedMotion;
    if (next) document.documentElement.setAttribute("data-reduced-motion", "");
    else document.documentElement.removeAttribute("data-reduced-motion");
    return { reducedMotion: next };
  }),
  guideOpen: false,
  setGuideOpen: (v) => set({ guideOpen: v }),

  // Overlays
  radialOpen: false,
  toggleRadial: () => set((s) => ({ radialOpen: !s.radialOpen })),
  closeRadial: () => set({ radialOpen: false }),
  shareOpen: false,
  openShare: () => set({ shareOpen: true }),
  closeShare: () => set({ shareOpen: false }),

  // Cover
  coverPassed: false,
  setCoverPassed: () => set({ coverPassed: true }),
  resetCoverPage: () => set({ coverPassed: false }),

  // Presentation
  isPresentationMode: false,
  currentSlideIndex: 0,
  presentationReturnState: null,
  presentationToolbarPosition: (() => {
    try {
      const saved = localStorage.getItem("dialect-viz-presentation-toolbar");
      if (saved) return JSON.parse(saved) as PresentationToolbarPosition;
    } catch {
      // ignore malformed saved state
    }
    const fallbackY = typeof window !== "undefined" ? Math.max(20, window.innerHeight - 68) : 20;
    return { x: 20, y: fallbackY };
  })(),
  setPresentationToolbarPosition: (position) => {
    const next = { x: Math.max(0, Math.round(position.x)), y: Math.max(0, Math.round(position.y)) };
    try {
      localStorage.setItem("dialect-viz-presentation-toolbar", JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
    set({ presentationToolbarPosition: next });
  },
  enterPresentation: () => {
    const s = get();
    set({
      isPresentationMode: true,
      currentSlideIndex: 0,
      guideOpen: false,
      selectedDialect: null,
      presentationReturnState: {
        currentView: s.currentView,
        tabView: s.tabView,
        treeMode: s.treeMode,
        subMode: s.subMode,
        childSelected: s.childSelected,
        mdsSource: s.mdsSource,
        selectedDialect: s.selectedDialect,
        compareDialect: s.compareDialect,
        hoveredDialectId: s.hoveredDialectId,
        guideOpen: s.guideOpen,
      },
    });
  },
  exitPresentation: () => {
    const saved = get().presentationReturnState;
    set({
      isPresentationMode: false,
      currentSlideIndex: 0,
      presentationReturnState: null,
      ...(saved ?? {}),
    });
  },
  goToSlide: (index) => set({ currentSlideIndex: index }),
}));
