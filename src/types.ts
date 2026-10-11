/**
 * types.ts — v4.1 merged types (v3 base + extensions)
 */

// ─── Dialect groups (v3 + broad categories) ───
export type DialectGroupV3 = "Mandarin" | "Wu" | "Yue" | "Min" | "Hakka" | "Xiang" | "Gan";

export const BROAD_CATEGORIES = [
  "官话", "吴语", "粤语", "闽语", "客家话", "湘语", "赣语",
  "晋语", "徽语", "平话土话", "标准语", "乡话", "戏曲音",
  "域外方音", "民族语", "未分类",
] as const;

export type BroadCategory = (typeof BROAD_CATEGORIES)[number];

// ─── Dialect point ───
export interface DialectPoint {
  id: string;
  name: string;
  title: string;
  lat: number;
  lng: number;
  region: string;       // 地圖集二分區 一级
  group: string;         // 地圖集二分區 二级
  subgroup: string;      // 地圖集二分區 三级
  broad: BroadCategory;  // 归一化大类
  color: string;
  symbol: string;
  ydFenqu: string;       // 音典分區
  csFenqu: string;       // 陳邡分區
  source: string;
  contributor: string;
  location: string;
  markerColor: string;
  // Optional: computed fields
  features?: { consonants: number | null; vowels: number | null; tones: number | null };
  sampleWords?: { concept: string; conceptZh?: string; ipa: string }[];
  groupMembers?: DialectPoint[];
  toneSystem?: string;
  adminProvince?: string;
  adminCity?: string;
  adminCounty?: string;
  adminTown?: string;
  references?: string;
  extraNotes?: string;
  dataRecorder?: string;
  dataRecommender?: string;
  dataAuthor?: string;
  charSet?: string;
  sourceURL?: string;
  isDialectIsland?: boolean;
}

// ─── Tree node ───
export interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
}

// ─── MDS coords ───
export interface MDSCoords {
  coords: [number, number][];
  ids: string[];
  groups: string[];
  names: string[];
  varianceExplained: number;
}

// ─── Char readings ───
export interface LanguageInfo {
  name: string;
  label: string;
}

export interface CharReadings {
  languages: Record<string, LanguageInfo>;
  langIndex: Record<string, Record<string, string>>;
  charIndex: Record<string, string[]>;
  totalChars: number;
}

// ─── MC phonology ───
export interface MCPhonology {
  initials: string[];
  rhymes: string[];
  she: string[];
  matrix: number[][];
  sheMatrix: number[][];
  totalEntries: number;
  charDetails?: Record<string, { c: string; f: string; r: string; g: string }[]>;
}

// ─── OC phonology ───
export interface OCPhonology {
  totalEntries: number;
  entries: { char: string; pinyin: string; mc: string; oc: string; gloss: string }[];
}

// ─── Dialects container ───
export interface DialectsContainer {
  points: DialectPoint[];
  tree: TreeNode;
  totalPoints: number;
  broadCategories: string[];
}

// ─── China GeoJSON (for ECharts) ───
export interface ChinaGeo {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown[] };
  }>;
}

// ─── Full data cache ───
export interface DataCache {
  dialects: DialectsContainer | null;
  charReadings: CharReadings | null;
  mcPhonology: MCPhonology | null;
  ocPhonology: OCPhonology | null;
  mdsCoords: MDSCoords | null;
  china: ChinaGeo | null;
}

// ─── Derived visualization stats ───
export interface InsightGroupStat {
  broad: string;
  count: number;
  geoSpanKm: number;
  avgCharCoverage: number;
  toneCoverageRate: number;
  avgToneCount: number;
  topProvinces: { name: string; count: number }[];
}

export interface InsightBundle {
  groupStats?: {
    totalPoints: number;
    totalGroups: number;
    groups: InsightGroupStat[];
    largestGroups: InsightGroupStat[];
    widestGroups: InsightGroupStat[];
    bestCoveredGroups: InsightGroupStat[];
  };
  mdsStats?: Record<string, unknown>;
  charDistinctiveness?: Record<
    string,
    {
      label: string;
      totalChars: number;
      totalFrequency: number;
      topFrequency: [string, number][];
      topDistinctive: { char: string; freq: number; share: number; distinctiveness: number }[];
    }
  >;
  phonologyStats?: {
    totalEntries: number;
    nonEmptyCells: number;
    emptyCells: number;
    emptyRate: number;
    topCells: { initial: string; she: string; value: number }[];
    topShe: { name: string; value: number }[];
    topInitials: { name: string; value: number }[];
  };
  chordStats?: {
    topPairs: { source: string; target: string; value: number }[];
    pairCount: number;
  };
  clusterStats?: {
    leafGroups: { group: string; count: number }[];
    mixedBranches: {
      name: string;
      size: number;
      dominantGroup: string;
      purity: number;
      groups: { group: string; count: number }[];
      distance: number;
    }[];
    leafCount: number;
  };
}

// ─── View ───
export type ViewName = "map" | "tree" | "scatter" | "matrix" | "charquery" | "zonestats" | "compsearch" | "history" | "sankey" | "parallel" | "ridge" | "chord" | "coverage" | "nushu" | "cjk" | "ime" | "treemap" | "tonecurve" | "dialectchar" | "phono" | "cluster" | "ling";
