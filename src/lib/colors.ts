import type { BroadCategory } from "@/types";
import { BROAD_COLORS } from "@/store/useAppStore";

// v3 group colors (OKLCH, for backward compat)
export const GROUP_COLORS_OKLCH: Record<string, string> = {
  Mandarin: "oklch(0.52 0.20 29)",
  Wu: "oklch(0.52 0.16 255)",
  Yue: "oklch(0.52 0.17 145)",
  Min: "oklch(0.48 0.18 310)",
  Hakka: "oklch(0.56 0.17 70)",
  Xiang: "oklch(0.45 0.09 60)",
  Gan: "oklch(0.54 0.14 350)",
};

export const GROUP_NAMES: Record<string, string> = {
  Mandarin: "官话", Wu: "吴语", Yue: "粤语", Min: "闽语",
  Hakka: "客家话", Xiang: "湘语", Gan: "赣语",
  Jinyu: "晋语", Hui: "徽语", Pinghua: "平话土话",
  Standard: "标准语", Xianghua: "乡话", Opera: "戏曲音",
  SinoXenic: "域外方音", Minority: "民族语",
};

export function getBroadColor(broad: string): string {
  return BROAD_COLORS[broad] || BROAD_COLORS["未分类"];
}

export function getGroupColor(group: string): string {
  return GROUP_COLORS_OKLCH[group] || getBroadColor(group) || "oklch(0.5 0 0)";
}

export function getGroupNameZh(group: string): string {
  return GROUP_NAMES[group] || group;
}
