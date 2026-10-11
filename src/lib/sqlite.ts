/**
 * sqlite.ts — sql.js 浏览器端查询字典数据库
 */
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let initPromise: Promise<void> | null = null;

export async function initDictDb(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    SQL = await initSqlJs({
      locateFile: (file: string) => `/${file}`,
    });
    const resp = await fetch("/mcpdict.db");
    const buffer = await resp.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
  })();

  return initPromise;
}

/**
 * Query a character's readings from the dictionary table by Unicode code point.
 * Returns readings for 13 language columns.
 */
export function queryChar(character: string): Record<string, string> | null {
  if (!db) return null;
  const codePoint = character.codePointAt(0)?.toString(16).toUpperCase();
  if (!codePoint) return null;

  try {
    const stmt = db.prepare(
      "SELECT unicode, mc, pu, ct, sh, mn, kr, vn, jp_go, jp_kan, jp_tou, jp_kwan, jp_other FROM mcpdict WHERE unicode = ?"
    );
    stmt.bind([codePoint]);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      stmt.free();
      const result: Record<string, string> = {};
      for (let i = 0; i < cols.length; i++) {
        result[cols[i]] = (vals[i] as string) || "";
      }
      return result;
    }
    stmt.free();
    return null;
  } catch {
    return null;
  }
}

const LANG_LABELS: Record<string, string> = {
  mc: "中古音",
  pu: "普通话(DB)", ct: "粤语(DB)", kr: "朝鲜语(DB)", vn: "越南语(DB)",
  jp_go: "日语(吴音)", jp_kan: "日语(汉音)", jp_tou: "日语(唐宋音)",
  jp_kwan: "日语(惯用音)", jp_other: "日语(其他)",
  sh: "上海话", mn: "闽南语",
};

const JP_ORDER = ["jp_go", "jp_kan", "jp_tou", "jp_kwan", "jp_other"];

/**
 * Get all database readings for a character, returning structured data
 * with primary readings (mc, sh, mn) and Japanese sub-readings separated.
 */
export function getExtraReadings(character: string): { label: string; reading: string }[] {
  const row = queryChar(character);
  if (!row) return [];
  const results: { label: string; reading: string }[] = [];
  for (const [key, label] of Object.entries(LANG_LABELS)) {
    const val = row[key];
    if (val && val.trim()) {
      results.push({ label, reading: val.trim() });
    }
  }
  return results;
}

/**
 * Get Japanese-only readings with sub-type labels.
 */
export function getJapaneseReadings(character: string): { label: string; reading: string }[] {
  const row = queryChar(character);
  if (!row) return [];
  const results: { label: string; reading: string }[] = [];
  for (const key of JP_ORDER) {
    const val = row[key];
    if (val && val.trim()) {
      results.push({ label: LANG_LABELS[key], reading: val.trim() });
    }
  }
  return results;
}

/**
 * Get MC/Shanghainese/Minnan readings from DB.
 */
export function getCoreReadings(character: string): { label: string; reading: string }[] {
  const row = queryChar(character);
  if (!row) return [];
  const results: { label: string; reading: string }[] = [];
  for (const key of ["mc", "sh", "mn"]) {
    const val = row[key];
    if (val && val.trim()) {
      results.push({ label: LANG_LABELS[key], reading: val.trim() });
    }
  }
  return results;
}
