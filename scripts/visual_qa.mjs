import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "visual-qa");
const BASE_URL = process.env.VISUAL_QA_URL ?? "http://127.0.0.1:3000";

const waitForChart = async (page, delay = 1500) => {
  await page.waitForSelector(".research-layout", { timeout: 30_000 });
  await page.waitForTimeout(delay);
};

const screenshot = async (page, name) => {
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    fullPage: false,
  });
  console.log(`captured ${name}`);
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(() => {
    localStorage.setItem("dialect-viz-theme", "light");
    localStorage.setItem("dialect-viz-font", "serif");
    localStorage.setItem("dialect-viz-lang", "zh-CN");
    localStorage.setItem("dialect-guide-style", "modal");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  console.log(`opening ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".cover").click({ timeout: 10_000 });
  await waitForChart(page);
  await screenshot(page, "01-map-light-1366.png");

  await page.getByRole("button", { name: /方言距|方言距離/ }).click();
  await waitForChart(page, 1000);
  await page.getByRole("button", { name: /语音距离|語音距離/ }).click();
  await waitForChart(page);
  await screenshot(page, "02-mds-ling-light-1366.png");

  await page.getByRole("button", { name: /方言聚类|方言聚類/ }).click();
  await waitForChart(page, 1800);
  await screenshot(page, "03-cluster-light-1366.png");

  await page.getByRole("button", { name: /音韵矩阵|音韻矩陣/ }).click();
  await waitForChart(page);
  await screenshot(page, "04-matrix-light-1366.png");

  await page.getByRole("button", { name: /音韵流图|音韻流圖/ }).click();
  await waitForChart(page);
  await screenshot(page, "05-sankey-light-1366.png");

  await page.getByRole("button", { name: /声调曲线|聲調曲線/ }).click();
  await waitForChart(page);
  await screenshot(page, "06-tone-light-1366.png");

  await page.getByRole("button", { name: "亮色" }).click();
  await page.waitForTimeout(800);
  await screenshot(page, "07-tone-dark-1366.png");

  await page.getByRole("button", { name: "衬线" }).click();
  await page.getByRole("button", { name: "简中" }).click();
  await page.waitForTimeout(800);
  await screenshot(page, "08-tone-dark-sans-trad-1366.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await screenshot(page, "09-tone-mobile-390.png");

  await browser.close();
  console.log(`visual qa screenshots written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
