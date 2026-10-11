"""
build_xiaoxuetang.py — 解析小学堂 434 个 xlsx，生成前端数据文件

输入: data_raw/xiaoxuetang/*.zip（直接从 zip 读取，Big5 解码文件名）
输出:
  public/data/xx_modern.json    — 现代方言读音，按 Unicode 码点索引
  public/data/xx_historical.json — 上古音+中古音各家拟音
  public/data/xx_overlap.json   — 小学堂地名 ↔ MCPDict 点 ID 映射
"""

import json, os, re, io
from pathlib import Path
from collections import defaultdict
from zipfile import ZipFile
from openpyxl import load_workbook

BASE = Path(__file__).resolve().parent.parent
ZIP_DIR = BASE / "data_raw" / "xiaoxuetang"
PUBLIC_DATA = BASE / "public" / "data"

# ─── Group classifiers ───
GROUP_MAP = {
    "ccr01_shangguyin":   "上古音",
    "ccr02_zhongguyin":   "中古音",
    "ccr03_yunshu":       "韻書",
    "ccr04_guanhua":      "官話",
    "ccr05_jinyu":        "晉語",
    "ccr06_wuyu":         "吳語",
    "ccr07_huiyu":        "徽語",
    "ccr08_ganyu":        "贛語",
    "ccr09_xiangyu":      "湘語",
    "ccr10_minyu":        "閩語",
    "ccr11_yueyu":        "粵語",
    "ccr12_pinghua":      "平話",
    "ccr13_keyu":         "客語",
    "ccr14_otherdialects":"其他土話",
}

HISTORICAL_GROUPS = {"ccr01_shangguyin", "ccr02_zhongguyin", "ccr03_yunshu"}

def decode_name(raw: str) -> str:
    """Decode Big5-encoded filename from zip (stored as CP437 bytes)."""
    try:
        return raw.encode("cp437").decode("big5")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return raw

# ─── Load existing dialects for matching ───
with open(PUBLIC_DATA / "dialects.json", encoding="utf-8") as f:
    mcp_points = json.load(f)["points"]

mcp_names = [(p["id"], p["name"], p.get("location", "")) for p in mcp_points]

def clean_point_name(raw: str) -> str:
    """Extract dialect point name from filename like '260 粵語_樂昌.xlsx' or '027 北京官話_北京.xlsx'."""
    name = raw.replace(".xlsx", "")
    name = re.sub(r'^\d+\s*', '', name)          # remove leading number
    # Remove known group prefixes (e.g. 粵語_, 北京官話_, 中原官話_, etc.)
    # The pattern is: [anything]_, i.e. everything before the first underscore
    # But also handle names like "粵語_廣州" where group+underscore precedes the actual point
    if "_" in name:
        # Check if the part before the first underscore is a known dialect classifier
        parts = name.split("_", 1)
        prefix = parts[0]
        actual = parts[1] if len(parts) > 1 else name
        # If prefix ends with 語/話/音/官話 or is a known group, strip it
        if any(prefix.endswith(s) for s in ["語", "話", "音", "官話"]):
            return actual.strip()
    return name.strip().strip("_").strip()

def match_mcp(point_name: str) -> dict | None:
    """Fuzzy match a Xiaoxuetang point name to MCPDict point"""
    # Direct match
    for pid, pname, ploc in mcp_names:
        if point_name == pname or point_name == pid:
            return {"mcp_id": pid, "mcp_name": pname, "match_type": "exact"}
    # Substring match (e.g. "廣州" in "廣州石牌話")
    for pid, pname, ploc in mcp_names:
        if point_name in pname or point_name in ploc or pname in point_name:
            return {"mcp_id": pid, "mcp_name": pname, "match_type": "partial"}
    return None

# ─── Parse all xlsx from zip files ───
modern_data: dict[str, dict[str, list]] = defaultdict(dict)  # {char_hex: {point_name: [{initial,final,tone,...}]}}
historical_data: dict[str, dict] = {}                         # {system_name: {char_hex: {initial, final, ...}}}
overlap_map: dict[str, dict] = {}                             # {xx_point_name: {mcp_id, match_type, group}}
point_stats: dict[str, dict] = {}                             # {xx_point_name: {char_count, group, matched}}

total_files = 0
total_rows = 0

zip_files = sorted(ZIP_DIR.glob("ccr*.zip"))
for zip_path in zip_files:
    dir_key = zip_path.stem  # e.g. "ccr04_guanhua"
    group_name = GROUP_MAP.get(dir_key, dir_key)
    is_historical = dir_key in HISTORICAL_GROUPS

    with ZipFile(zip_path, "r") as zf:
        for entry_name in zf.namelist():
            if not entry_name.lower().endswith(".xlsx"):
                continue
            decoded = decode_name(entry_name)
            fname = os.path.basename(decoded)
            point_name = clean_point_name(fname)
            if not point_name:
                continue
            total_files += 1

            raw_bytes = zf.read(entry_name)
            wb = load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
            wb = load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                headers = None
                row_count = 0
                system_key = sheet_name

                for row in ws.iter_rows(values_only=True):
                    vals = [str(v).strip() if v is not None else "" for v in row]
                    if not headers:
                        headers = vals
                        continue
                    if not vals[0] or len(vals) < 2:
                        continue

                    record = {}
                    for i, h in enumerate(headers):
                        if i < len(vals) and vals[i]:
                            record[h] = vals[i]

                    char = record.get("字", "")
                    if not char or len(char) > 2:
                        continue
                    row_count += 1
                    total_rows += 1

                    char_code = f"{ord(char):05X}"

                    if is_historical:
                        entry = {
                            "char": char,
                            "initial": record.get("聲母", ""),
                            "final": record.get("韻母", ""),
                            "note": record.get("備註", ""),
                        }
                        if system_key not in historical_data:
                            historical_data[system_key] = {}
                        historical_data[system_key][char_code] = entry
                    else:
                        entry = {
                            "char": char,
                            "initial": record.get("聲母", ""),
                            "final": record.get("韻母", ""),
                            "tone_value": record.get("調值", ""),
                            "tone_category": record.get("調類", ""),
                            "note": record.get("備註", ""),
                        }
                        if char_code not in modern_data:
                            modern_data[char_code] = {}
                        if point_name not in modern_data[char_code]:
                            modern_data[char_code][point_name] = []
                        modern_data[char_code][point_name].append(entry)

            wb.close()

            # Match with MCPDict
            match = match_mcp(point_name) if not is_historical else None
            if not is_historical:
                overlap_map[point_name] = {
                    "mcp_id": match["mcp_id"] if match else None,
                    "mcp_name": match["mcp_name"] if match else None,
                    "match_type": match["match_type"] if match else "new",
                    "group": group_name,
                }
            point_stats[point_name] = {
                "chars": row_count,
                "group": group_name,
                "matched": match is not None,
            }

# ─── Write output ───
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

# Bundle modern data by character range (256 chars per bundle)
BUNDLE_SIZE = 256
bundles: dict[str, dict] = defaultdict(dict)
for char_code, point_data in modern_data.items():
    cp = int(char_code, 16)
    bundle_idx = (cp // BUNDLE_SIZE) * BUNDLE_SIZE
    bundle_key = f"{bundle_idx:05X}"
    bundles[bundle_key][char_code] = point_data

bundle_dir = PUBLIC_DATA / "xx_bundles"
bundle_dir.mkdir(parents=True, exist_ok=True)
for key, data in bundles.items():
    path = bundle_dir / f"{key}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

# Historical data
with open(PUBLIC_DATA / "xx_historical.json", "w", encoding="utf-8") as f:
    json.dump(historical_data, f, ensure_ascii=False)

# Overlap map
with open(PUBLIC_DATA / "xx_overlap.json", "w", encoding="utf-8") as f:
    json.dump(overlap_map, f, ensure_ascii=False, indent=2)

# Stats
matched = sum(1 for v in overlap_map.values() if v["match_type"] != "new")
new_pts = sum(1 for v in overlap_map.values() if v["match_type"] == "new")

print(f"Files processed: {total_files}")
print(f"Total readings: {total_rows:,}")
print(f"Modern characters: {len(modern_data):,}")
print(f"Bundles: {len(bundles)}")
print(f"Historical systems: {len(historical_data)}")
print(f"Points matched: {matched}")
print(f"New points: {new_pts}")
print(f"Data files written to {PUBLIC_DATA}")
