"""
preprocess_v2.py (v2.1) — 修正版
修复：字段映射 | 分类树 | MDS 距离矩阵 | langs 表导出

输出 (public/data/):
  dialects.json   — 2707 点 + 正确分类树
  char_readings.json — Unihan 读音
  mc_phonology.json  — 中古音矩阵
  oc_phonology.json  — 上古音
  mds_coords.json    — 2707 点 MDS 2D 坐标
  china.json         — 精简 GeoJSON
"""

import csv
import json
import re
import math
import sqlite3
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
RAW_MCP = BASE_DIR / "data_raw" / "mcpdict"
RAW_DIR = BASE_DIR / "data_raw"
PUBLIC_DATA = BASE_DIR / "public" / "data"

# ─── 归一化：地圖集二分區 一级 → 大类 ───
DI2_TO_BROAD = {
    "東北官話": "官话", "北京官話": "官话", "冀魯官話": "官话",
    "膠遼官話": "官话", "中原官話": "官话", "蘭銀官話": "官话",
    "西南官話": "官话", "江淮官話": "官话", "官話": "官话",
    "吳語": "吴语", "粤語": "粤语", "閩語": "闽语",
    "客家話": "客家话", "湘語": "湘语", "贛語": "赣语",
    "晉語": "晋语", "徽語": "徽语",
    "平話和土話": "平话土话",
    "現代標準漢語": "标准语",
    "鄉話": "乡话", "戲劇": "戏曲音",
    "域外方音": "域外方音", "民族語": "民族语",
}

BROAD_COLORS = {
    "官话": "#c43a31", "吴语": "#4a7c59", "粤语": "#d4926a",
    "闽语": "#e8b44a", "客家话": "#7b9e6d", "湘语": "#8e6b4f",
    "赣语": "#6b8e8a", "晋语": "#c08060", "徽语": "#a09080",
    "平话土话": "#b0a080", "标准语": "#3d3226",
    "乡话": "#9a8a6a", "戏曲音": "#d4a0a0",
    "域外方音": "#6080a0", "民族语": "#80a060",
    "未分类": "#a0a0a0",
}

# ─── Step 1: Parse info.geojson → dialects.json ───

def parse_info_geojson(path):
    with open(path, "r", encoding="utf-8") as f:
        gj = json.load(f)

    dialects = []
    for feat in gj.get("features", []):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [0, 0])
        lng, lat = coords[0], coords[1]

        # Parse 地圖集二分區: "東北官話－黑松片－嫩克小片" → [region, group, subgroup]
        di2 = props.get("地圖集二分區", "")
        parts = [p.strip() for p in di2.split("－")] if di2 else []
        region = parts[0] if len(parts) > 0 else ""
        group = parts[1] if len(parts) > 1 else ""
        subgroup = parts[2] if len(parts) > 2 else ""

        # Normalize to broad category
        broad = DI2_TO_BROAD.get(region, region if region else "未分类")

        # Also get音典分區 and 陳邡分區 for reference
        ydfq = props.get("音典分區", "")
        csfq = props.get("陳邡分區", "")

        dialect = {
            "id": props.get("title", ""),
            "name": props.get("語言", props.get("title", "")),
            "title": props.get("title", ""),
            "lat": lat,
            "lng": lng,
            "region": region,         # 地圖集二分區 一级
            "group": group,           # 地圖集二分區 二级
            "subgroup": subgroup,     # 地圖集二分區 三级
            "broad": broad,           # 归一化大类
            "color": BROAD_COLORS.get(broad, BROAD_COLORS["未分类"]),
            "symbol": props.get("marker-symbol", ""),
            "ydFenqu": ydfq,         # 音典分區
            "csFenqu": csfq,         # 陳邡分區
            "source": props.get("字表來源", ""),
            "contributor": props.get("維護人", ""),
            "location": props.get("地點", ""),
            "markerColor": props.get("marker-color", ""),
        }
        dialects.append(dialect)

    return dialects


def extract_classification_tree(dialects):
    """构建三级分类树: broad → region → group"""
    tree = {"name": "汉语方言", "children": []}
    broad_map = {}

    for d in dialects:
        broad = d.get("broad", "未分类")
        region = d.get("region", "未分类")
        group = d.get("group", "未分类")

        if broad not in broad_map:
            node = {"name": broad, "children": []}
            tree["children"].append(node)
            broad_map[broad] = {"node": node, "regions": {}}

        rm = broad_map[broad]["regions"]
        if region not in rm:
            rnode = {"name": region, "children": []}
            broad_map[broad]["node"]["children"].append(rnode)
            rm[region] = {"node": rnode, "groups": {}}

        gm = rm[region]["groups"]
        if group not in gm:
            gnode = {"name": group, "value": 0}
            rm[region]["node"]["children"].append(gnode)
            gm[group] = gnode
        gm[group]["value"] = (gm[group].get("value") or 0) + 1

    # Remove empty children
    for bnode in tree.get("children", []):
        bnode["children"] = [r for r in bnode.get("children", []) if r.get("children")]
        for rnode in bnode.get("children", []):
            if "value" not in rnode:
                total = sum(c.get("value", 0) for c in rnode.get("children", []))
                rnode["value"] = total

    return tree


# ─── Step 2: Unihan Readings ───

UNIHAN_FIELDS = {
    "kCantonese": "ct", "kMandarin": "pu",
    "kJapaneseOn": "jp_on", "kJapaneseKun": "jp_kun",
    "kKorean": "kr", "kVietnamese": "vn",
    "kHangul": "kr_hangul", "kTang": "jp_tang",
    "kDefinition": "def",
}

LANG_LABELS = {
    "ct": "粤语", "pu": "普通话",
    "jp_on": "日语(音)", "jp_kun": "日语(训)",
    "kr": "朝鲜语", "vn": "越南语",
    "kr_hangul": "朝鲜语(谚)", "jp_tang": "日语(唐)",
    "def": "释义",
}

def parse_unihan(path):
    readings = defaultdict(dict)
    char_set = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t", 2)
            if len(parts) < 3:
                continue
            cp, field, value = parts
            if not cp.startswith("U+"):
                continue
            char = chr(int(cp[2:], 16))
            fn = UNIHAN_FIELDS.get(field)
            if fn:
                readings[char][fn] = value
                char_set.add(char)

    lang_index = defaultdict(dict)
    for char, langs in readings.items():
        for lang, reading in langs.items():
            lang_index[lang][char] = reading

    char_index = {}
    for char, langs in readings.items():
        char_index[char] = list(langs.keys())

    return {
        "languages": {k: {"name": LANG_LABELS.get(k, k), "label": k}
                      for k in lang_index},
        "langIndex": {k: dict(v) for k, v in lang_index.items()},
        "charIndex": char_index,
        "totalChars": len(char_set),
    }


# ─── Step 3: 廣韻 Matrix ───

def parse_guangyun(path):
    initials = set()
    rhymes = set()
    she_set = set()
    matrix = defaultdict(lambda: defaultdict(int))
    matrix_she = defaultdict(lambda: defaultdict(int))
    # Collect character details per (init, she_clean) — guarantees count consistency
    char_details = defaultdict(list)

    with open(path, "r", encoding="utf-8") as f:
        f.readline()
        for line in f:
            parts = line.strip("\n").split("\t")
            if len(parts) < 6:
                continue
            desc = parts[2].strip() if len(parts) > 2 else ""
            she = parts[3].strip() if len(parts) > 3 else ""
            ym = parts[5].strip() if len(parts) > 5 else ""
            char = parts[1].strip() if len(parts) > 1 else ""
            fanqie = parts[7].strip() if len(parts) > 7 else ""
            reading = parts[8].strip() if len(parts) > 8 else ""
            gloss = parts[26].strip() if len(parts) > 26 else ""
            if not desc or not she:
                continue

            m = re.match(r"^(\D+?)[一二三四]", desc)
            if not m:
                continue
            init = m.group(1)

            she_clean = she.replace("攝", "")
            ym_clean = re.sub(r"[上下去入]平聲?\d*", "", ym)
            ym_clean = re.sub(r"[上下去入]聲?\d*", "", ym_clean)
            if not ym_clean:
                ym_clean = ym

            initials.add(init)
            rhymes.add(ym_clean)
            she_set.add(she_clean)
            matrix[init][ym_clean] += 1
            matrix_she[init][she_clean] += 1
            if char:
                char_details[f"{init}||{she_clean}"].append({
                    "c": char, "f": fanqie, "r": reading, "g": gloss,
                })

    init_list = sorted(initials)
    rhyme_list = sorted(rhymes)
    she_list = sorted(she_set)

    grid = []
    for init in init_list:
        grid.append([matrix[init].get(r, 0) for r in rhyme_list])

    she_grid = []
    for init in init_list:
        she_grid.append([matrix_she[init].get(s, 0) for s in she_list])

    return {
        "initials": init_list,
        "rhymes": rhyme_list,
        "she": she_list,
        "matrix": grid,
        "sheMatrix": she_grid,
        "totalEntries": sum(sum(r) for r in grid),
        "charDetails": dict(char_details),
    }


# ─── Step 4: Baxter-Sagart OC ───

def parse_bs_oc(path):
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        f.readline()
        for line in f:
            parts = line.strip("\n").split("\t")
            if len(parts) >= 5:
                entries.append({
                    "char": parts[0].strip(),
                    "pinyin": parts[1].strip() if len(parts) > 1 else "",
                    "mc": parts[2].strip() if len(parts) > 2 else "",
                    "oc": parts[4].strip() if len(parts) > 4 else "",
                    "gloss": parts[5].strip() if len(parts) > 5 else "",
                })
    return {"totalEntries": len(entries), "entries": entries}


# ─── Step 5: Haversine Distance + MDS ───

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_mds_coords(dialects):
    """计算 2707 点 Haversine 距离矩阵 + MDS 降维"""
    n = len(dialects)
    if n < 2:
        return {"coords": [[0, 0]] * n, "ids": [d["id"] for d in dialects]}

    # Build distance matrix (lower triangle, then mirror)
    print(f"  Computing {n}x{n} Haversine distance matrix...")
    D = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine(
                dialects[i]["lat"], dialects[i]["lng"],
                dialects[j]["lat"], dialects[j]["lng"]
            )
            D[i][j] = d
            D[j][i] = d

    # Classical MDS: double centering + eigendecomposition
    print("  Running MDS...")
    # Square the distances
    D2 = [[D[i][j] ** 2 for j in range(n)] for i in range(n)]

    # Double center: B = -0.5 * J * D2 * J
    row_means = [sum(row) / n for row in D2]
    grand_mean = sum(row_means) / n

    B = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            B[i][j] = -0.5 * (D2[i][j] - row_means[i] - row_means[j] + grand_mean)

    # Power iteration for top 2 eigenvectors
    def mat_vec_mul(M, v):
        return [sum(M[i][j] * v[j] for j in range(n)) for i in range(n)]

    def normalize(v):
        norm = math.sqrt(sum(x * x for x in v))
        return [x / norm for x in v]

    def power_iteration(M, iters=50):
        v = [1.0 / math.sqrt(n)] * n
        for _ in range(iters):
            v_new = mat_vec_mul(M, v)
            v = normalize(v_new)
        # Rayleigh quotient for eigenvalue
        mv = mat_vec_mul(M, v)
        eigenval = sum(v[i] * mv[i] for i in range(n))
        return eigenval, v

    # Get top 2 eigenvectors
    eigval1, eigvec1 = power_iteration(B)
    # Deflate and get second
    B2 = [[B[i][j] - eigval1 * eigvec1[i] * eigvec1[j] for j in range(n)] for i in range(n)]
    eigval2, eigvec2 = power_iteration(B2)

    # Build coordinates
    coords = []
    for i in range(n):
        coords.append([
            round(eigvec1[i] * math.sqrt(max(eigval1, 0)), 4),
            round(eigvec2[i] * math.sqrt(max(eigval2, 0)), 4),
        ])

    # Variance explained
    total_trace = sum(B[i][i] for i in range(n))
    explained = (eigval1 + eigval2) / total_trace * 100 if total_trace > 0 else 0

    print(f"  MDS done: {explained:.1f}% variance explained")

    return {
        "coords": coords,
        "ids": [d["id"] for d in dialects],
        "groups": [d["broad"] for d in dialects],
        "names": [d["name"] for d in dialects],
        "varianceExplained": round(explained, 1),
    }


# ─── Step 6: langs table export (from mcpdict.db) ───

def export_langs_table():
    """尝试导出 mcpdict.db 的读数字表"""
    db_path = RAW_MCP / "mcpdict.db"
    if not db_path.exists():
        print("  mcpdict.db not found, skipping langs export")
        return None

    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        # Try reading mcpdict_content directly (FTS3 shadow table)
        c.execute("SELECT * FROM mcpdict_content LIMIT 5")
        rows = c.fetchall()
        print(f"  mcpdict_content: {len(rows)} sample rows (columns in shadow table)")
        conn.close()
        return None  # Shadow table format not suitable for direct use
    except Exception as e:
        print(f"  langs export skipped (FTS not available): {e}")
        return None


# ─── Step 7: China GeoJSON ───

def simplify_china_geojson(output_path):
    raw_path = RAW_DIR / "chinageo.json"
    if not raw_path.exists():
        print("  China GeoJSON not found, skipping")
        return
    with open(raw_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    def simplify(coords):
        if isinstance(coords, (int, float)):
            return round(coords, 5)
        if isinstance(coords, list):
            if len(coords) > 0 and isinstance(coords[0], (int, float)):
                return [round(c, 5) for c in coords]
            return [simplify(c) for c in coords]
        return coords

    if "features" in data:
        for feat in data["features"]:
            if "geometry" in feat and feat["geometry"]:
                feat["geometry"]["coordinates"] = simplify(feat["geometry"]["coordinates"])

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  china.json: {output_path.stat().st_size:,} bytes")


# ─── Main ───

def main():
    print("=== Preprocessing MCPDict Data v2.1 ===\n")
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

    # [1] Dialects
    print("[1/6] Parsing info.geojson → dialects.json...")
    gj_path = RAW_MCP / "info.geojson"
    if not gj_path.exists():
        print("  ❌ info.geojson not found")
        return
    dialects = parse_info_geojson(gj_path)
    print(f"  Parsed {len(dialects)} points")

    # Post-processing: fix 武勝話 classification (geographically between 廣安 and 岳池, both 官话→川黔片)
    for d in dialects:
        if d["id"] == "武勝":
            d["region"] = "西南官话"
            d["group"] = "川黔片"
            d["subgroup"] = "成渝小片"
            d["broad"] = "官话"
            d["color"] = BROAD_COLORS["官话"]
            d["ydFenqu"] = "中上江－四川－川中"
            print("  ✅ Fixed 武勝話 → 官话/西南官话/川黔片 + ydFenqu=中上江")
            continue
        # 建寧: ydFenqu says "類閩", actually geographic/cultural Min
        if d["id"] == "建寧":
            d["region"] = "閩語"
            d["group"] = "邵將片"
            d["broad"] = "闽语"
            d["color"] = BROAD_COLORS["闽语"]
            print("  ✅ Fixed 建寧話 → 闽语/邵將片")

    # Count broad categories
    broad_counts = defaultdict(int)
    for d in dialects:
        broad_counts[d["broad"]] += 1
    print(f"  Broad categories: {len(broad_counts)}")
    for k, v in sorted(broad_counts.items(), key=lambda x: -x[1]):
        print(f"    {k}: {v}")

    # Build classification tree
    tree = extract_classification_tree(dialects)
    broad_nodes = len(tree.get("children", []))
    print(f"  Classification tree: {broad_nodes} broad categories")

    # Write dialects.json
    out = PUBLIC_DATA / "dialects.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({
            "points": dialects,
            "tree": tree,
            "totalPoints": len(dialects),
            "broadCategories": sorted(broad_counts.keys()),
        }, f, ensure_ascii=False, indent=2)
    print(f"  dialects.json: {out.stat().st_size:,} bytes")

    # [2] Unihan
    print("\n[2/6] Parsing Unihan_Readings.txt → char_readings.json...")
    u_path = RAW_MCP / "Unihan_Readings.txt"
    if u_path.exists():
        char_data = parse_unihan(u_path)
        out = PUBLIC_DATA / "char_readings.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(char_data, f, ensure_ascii=False)
        print(f"  {char_data['totalChars']} chars × {len(char_data['languages'])} langs")
        print(f"  char_readings.json: {out.stat().st_size:,} bytes")

    # [3] 廣韻
    print("\n[3/6] Parsing 廣韻.tsv → mc_phonology.json...")
    gy_path = RAW_MCP / "廣韻.tsv"
    if gy_path.exists():
        mc = parse_guangyun(gy_path)
        out = PUBLIC_DATA / "mc_phonology.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(mc, f, ensure_ascii=False)
        print(f"  {len(mc['initials'])} initials × {len(mc['rhymes'])} rhymes ({mc['totalEntries']} entries)")
        print(f"  mc_phonology.json: {out.stat().st_size:,} bytes")

    # [4] OC
    print("\n[4/6] Parsing BaxterSagartOC.tsv → oc_phonology.json...")
    bs_path = RAW_MCP / "BaxterSagartOC.tsv"
    if bs_path.exists():
        oc = parse_bs_oc(bs_path)
        out = PUBLIC_DATA / "oc_phonology.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(oc, f, ensure_ascii=False)
        print(f"  {oc['totalEntries']} entries")
        print(f"  oc_phonology.json: {out.stat().st_size:,} bytes")

    # [5] MDS
    print("\n[5/6] Computing MDS coordinates → mds_coords.json...")
    mds = compute_mds_coords(dialects)
    out = PUBLIC_DATA / "mds_coords.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(mds, f, ensure_ascii=False)
    print(f"  mds_coords.json: {out.stat().st_size:,} bytes")

    # [6] China GeoJSON
    print("\n[6/6] Simplifying China GeoJSON...")
    simplify_china_geojson(PUBLIC_DATA / "china.json")

    # langs table attempt
    print("\n[l] Attempting langs table export...")
    export_langs_table()

    # Copy mcpdict.db
    src_db = RAW_MCP / "mcpdict.db"
    dst_db = BASE_DIR / "public" / "mcpdict.db"
    if src_db.exists():
        dst_db.write_bytes(src_db.read_bytes())
        print(f"  mcpdict.db copied to public/ ({dst_db.stat().st_size:,} bytes)")

    print("\n=== Done ===\n")
    for f in ["dialects.json", "char_readings.json", "mc_phonology.json",
              "oc_phonology.json", "mds_coords.json", "china.json"]:
        p = PUBLIC_DATA / f
        status = f"{p.stat().st_size:,} bytes" if p.exists() else "NOT FOUND"
        print(f"  {'✅' if p.exists() else '❌'} {f} ({status})")


if __name__ == "__main__":
    main()
