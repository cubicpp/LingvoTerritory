import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "visual-qa", "figures", "views");
const BASE_URL = process.env.VISUAL_QA_URL ?? "https://lingvoterritory.netlify.app";
const START_AT = process.env.VISUAL_QA_START_AT ?? "";
const STOP_AFTER = process.env.VISUAL_QA_STOP_AFTER ?? "";

const ROUTES = [
  { name: "map", parent: "地理分布" },
  { name: "zonestats", parent: "区域统计" },
  { name: "scatter-geo", parent: "方言距离", tab: "地理距离" },
  { name: "scatter-ling", parent: "方言距离", tab: "语音距离" },
  { name: "tree-radial", parent: "分类谱系", tab: "谱系树" },
  { name: "tree-treemap", parent: "分类谱系", tab: "矩形树" },
  { name: "cluster", parent: "层次聚类" },
  { name: "cluster-yue", parent: "层次聚类", extraClicks: ["粤语"] },
  { name: "chord", parent: "亲疏关系" },
  { name: "dialectchar", parent: "特征文字" },
  { name: "charquery", parent: "汉字分析", tab: "读音查询" },
  { name: "dictcompare", parent: "汉字分析", tab: "字典对照" },
  { name: "history", parent: "汉字分析", tab: "历史演变" },
  { name: "nushu", parent: "汉字分析", tab: "江永女书" },
  { name: "cjk", parent: "汉字分析", tab: "汉日韩越" },
  { name: "ime", parent: "汉字分析", tab: "编码透视" },
  { name: "phono", parent: "汉字分析", tab: "拟音对比" },
  { name: "compsearch", parent: "字符探源" },
  { name: "matrix", parent: "音韵分析", tab: "音韵格局" },
  { name: "matrix-rose", parent: "音韵分析", tab: "音韵格局", extraClicks: ["广韵（南丁格尔）"] },
  { name: "coverage", parent: "音韵分析", tab: "音韵覆盖" },
  { name: "sankey", parent: "音韵流图" },
  { name: "parallel", parent: "音系对比", tab: "平行坐标" },
  { name: "ridge", parent: "音系对比", tab: "山脊图" },
  { name: "tonecurve", parent: "声调曲线" },
];

async function waitForView(page, delay = 1800) {
  await page.waitForSelector(".view-panel", { timeout: 30000 });
  await page.waitForSelector(".view-content", { timeout: 30000 });
  await page.waitForFunction(() => {
    const el = document.querySelector(".loading-screen");
    if (!el) return true;
    const style = window.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(delay);
}

async function clickByText(page, text) {
  const exact = page.getByRole("button", { name: new RegExp(`^${text}$`) });
  if (await exact.count()) {
    await exact.first().click();
    return;
  }
  const fuzzy = page.getByRole("button", { name: new RegExp(text) });
  if (await fuzzy.count()) {
    await fuzzy.first().click();
    return;
  }
  await page.getByText(text, { exact: true }).first().click();
}

async function openRoute(page, route) {
  await clickByText(page, route.parent);
  await waitForView(page, 1400);
  if (route.tab) {
    await clickByText(page, route.tab);
    await waitForView(page, route.name === "ridge" ? 2200 : 1600);
  }
  if (route.extraClicks?.length) {
    for (const text of route.extraClicks) {
      await clickByText(page, text);
      await waitForView(page, 1800);
    }
  }
}

async function captureView(page, route) {
  console.log(`opening ${route.name}`);
  await openRoute(page, route);
  const panel = page.locator(".view-panel");
  await panel.screenshot({
    path: path.join(OUT_DIR, `${route.name}.png`),
  });
  console.log(`captured ${route.name}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(() => {
    localStorage.setItem("dialect-viz-theme", "light");
    localStorage.setItem("dialect-viz-font", "serif");
    localStorage.setItem("dialect-viz-lang", "zh-CN");
    localStorage.setItem("dialect-viz-fontsize", "standard");
    localStorage.setItem("dialect-guide-style", "modal");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".cover").click();
  await waitForView(page, 2600);

  const startIndex = START_AT ? Math.max(0, ROUTES.findIndex((route) => route.name === START_AT)) : 0;
  const stopIndex = STOP_AFTER ? ROUTES.findIndex((route) => route.name === STOP_AFTER) : -1;
  const routesToRun = stopIndex >= startIndex ? ROUTES.slice(startIndex, stopIndex + 1) : ROUTES.slice(startIndex);

  for (const route of routesToRun) {
    await captureView(page, route);
  }

  await browser.close();
  console.log(`screenshots written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});