"""
preprocess_v4.py — Extract ALL unused MCPDict data into JSON for LingvoTerritory
Handles Tier 1-3 datasets in a single pass.
"""
import json
import re
import csv
import os
import shutil
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
MCP_DIR = BASE_DIR.parent / "MCPDict"
RAW_MCP = BASE_DIR / "data_raw" / "mcpdict"
PUBLIC_DATA = BASE_DIR / "public" / "data"

CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")

def compact_json(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'))

def save_json(name, data):
    p = PUBLIC_DATA / f"{name}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(compact_json(data))
    kb = p.stat().st_size / 1024
    print(f"  → {name}.json ({kb:.0f} KB)")

# ─── Ensure source files are copied ───
def copy_if_needed(rel_path, name):
    dest = RAW_MCP / name
    if not dest.exists():
        src = MCP_DIR / rel_path
        if src.exists():
            shutil.copy2(src, dest)
            print(f"  [copy] {name}")
        else:
            print(f"  [MISS] {name} — not found")

# ─── T1.1: Per-dialect readings aggregation ───
def aggregate_dialect_readings():
    print("\n=== T1.1: Aggregating 2760 per-dialect TSVs ===")
    output_dir = MCP_DIR / "tools" / "tables" / "output"
    if not output_dir.exists():
        print("  OUTPUT DIR NOT FOUND")
        return

    # Load dialect points + _詳情 for name matching
    with open(PUBLIC_DATA / "dialects.json", encoding='utf-8') as f:
        points = json.load(f).get("points", [])

    # Build multiple lookup strategies
    id_to_name = {}
    name_to_id = {}
    title_to_id = {}
    for p in points:
        pid = p["id"]
        id_to_name[pid] = p.get("name", "")
        name_to_id[p.get("name", "")] = pid
        name_to_id[p.get("title", "")] = pid
        # Without suffix
        n = p.get("name", "").rstrip("话話方言方言")
        if n and n != p.get("name", ""):
            name_to_id[n] = pid

    # Try to load _詳情.json for better matching
    xiangqing_path = MCP_DIR / "tools" / "tables" / "output" / "_詳情.json"
    xq = {}
    if xiangqing_path.exists():
        with open(xiangqing_path, encoding='utf-8') as f:
            xq = json.load(f)
        for key, info in xq.items():
            jc = info.get("簡稱", "")
            if jc:
                name_to_id[jc] = name_to_id.get(jc, key)
            fn = info.get("文件名", "")
            if fn:
                stem = os.path.splitext(fn)[0]
                name_to_id[stem] = name_to_id.get(stem, key)

    tsv_files = sorted(output_dir.glob("*.tsv"))
    print(f"  Found {len(tsv_files)} TSV files")

    char_index: dict[str, list[dict]] = defaultdict(list)
    matched = 0
    unmatched = 0

    for tsv_path in tsv_files:
        base = tsv_path.stem
        # Skip metadata files
        if base.startswith("_") or base.startswith("."):
            continue

        # Match filename to dialect point
        pid = name_to_id.get(base)
        if not pid:
            # Try fuzzy match
            clean = re.sub(r"[\d\-_.].*$", "", base).strip()
            pid = name_to_id.get(clean)
        if not pid:
            # Try substring match
            for name, pid_candidate in name_to_id.items():
                if len(name) >= 2 and name in base:
                    pid = pid_candidate
                    break

        if not pid:
            unmatched += 1
            continue
        matched += 1

        # Read TSV: #漢字\t音標\t解釋
        try:
            with open(tsv_path, encoding='utf-8') as f:
                f.readline()  # skip header
                line_count = 0
                for line in f:
                    line = line.strip('\n')
                    if not line:
                        continue
                    parts = line.split('\t')
                    if len(parts) < 2:
                        continue
                    ch = parts[0].strip()
                    if not ch or len(ch) > 2 or not CJK_RE.search(ch):
                        continue
                    reading = parts[1].strip()
                    comment = parts[2].strip() if len(parts) > 2 else ""
                    if reading:
                        line_count += 1
                        char_index[ch].append({
                            "p": pid,
                            "r": reading,
                            "c": comment,
                        })
                if matched % 200 == 0:
                    print(f"    [{matched}] {base} → {line_count} 条")
        except Exception:
            continue

    total_chars = len(char_index)
    total_entries = sum(len(v) for v in char_index.values())
    print(f"  Matched: {matched} dialects, Unmatched: {unmatched}")
    print(f"  {total_chars} unique chars, {total_entries} total readings")

    # Save as {charIndex: {char: [{p: pointId, r: reading, c: comment}]}}
    save_json("dialect_readings_full", {"charIndex": dict(char_index)})
    return char_index

# ─── T1.2: MOE Dictionary ───
def parse_moe_dict():
    print("\n=== T1.2: Parsing MOE Dictionary ===")
    copy_if_needed("tools/tables/data/dict_revised_1.tsv", "dict_revised_1.tsv")
    path = RAW_MCP / "dict_revised_1.tsv"
    if not path.exists():
        print("  NOT FOUND")
        return

    entries: dict[str, list[dict]] = defaultdict(list)
    with open(path, encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        header = next(reader)
        for row in reader:
            if len(row) < 11:
                continue
            word = row[0].strip()
            if not word or not CJK_RE.search(word):
                continue
            entry = {
                "w": word,
                "z": row[6].strip() if len(row) > 6 else "",  # 注音
                "p": row[7].strip() if len(row) > 7 else "",  # 拼音
                "d": row[10].strip() if len(row) > 10 else "", # 釋義
                "s": row[8].strip() if len(row) > 8 else "",   # 相似詞
                "a": row[9].strip() if len(row) > 9 else "",   # 相反詞
            }
            if entry["d"]:
                entries[word[0]].append(entry)

    result = {}
    for ch, words in entries.items():
        if len(words) > 20:
            words = words[:20]  # limit per character
        result[ch] = words

    print(f"  {len(result)} characters, {sum(len(v) for v in result.values())} entries")
    save_json("moe_dict", result)

# ─── T1.3: _詳情.json metadata enrichment ───
def enrich_dialect_metadata():
    print("\n=== T1.3: Enriching dialect metadata from _詳情.json ===")
    xq_path = MCP_DIR / "tools" / "tables" / "output" / "_詳情.json"
    if not xq_path.exists():
        print("  NOT FOUND")
        return

    with open(xq_path, encoding='utf-8') as f:
        xq = json.load(f)

    with open(PUBLIC_DATA / "dialects.json", encoding='utf-8') as f:
        dialects = json.load(f)

    points = dialects.get("points", [])
    # Build lookup keys
    lookup: dict[str, dict] = {}
    for key, info in xq.items():
        jc = info.get("簡稱", "")
        yy = info.get("語言", "")
        if jc:
            lookup[jc] = info
        if yy:
            lookup[yy] = info

    enriched = 0
    for p in points:
        info = lookup.get(p.get("name", "")) or lookup.get(p.get("title", ""))
        if not info:
            # Try without suffix
            n = p.get("name", "").rstrip("话話方言方言")
            info = lookup.get(n)
        if info:
            p["toneSystem"] = info.get("聲調", "{}")
            p["adminProvince"] = info.get("省", "")
            p["adminCity"] = info.get("市", "")
            p["adminCounty"] = info.get("縣", "")
            p["adminTown"] = info.get("鎮", "")
            p["references"] = info.get("參考文獻", "")
            p["extraNotes"] = info.get("說明", "") or info.get("音系說明", "")
            p["dataRecorder"] = info.get("錄入人", "")
            p["dataRecommender"] = info.get("推薦人", "")
            p["dataAuthor"] = info.get("作者", "")
            p["charSet"] = info.get("繁簡", "")
            p["sourceURL"] = info.get("網址", "")
            p["isDialectIsland"] = info.get("方言島", False)
            enriched += 1

    with open(PUBLIC_DATA / "dialects.json", 'w', encoding='utf-8') as f:
        json.dump(dialects, f, ensure_ascii=False)
    print(f"  Enriched {enriched}/{len(points)} dialect points")
    save_json("dialect_detail", {})  # placeholder

# ─── T2.4: Zhengzhang OC ───
def parse_zhengzhang():
    print("\n=== T2.4: Parsing Zhengzhang OC ===")
    copy_if_needed("tools/tables/data/DrienghTriang.txt", "DrienghTriang.txt")
    path = RAW_MCP / "DrienghTriang.txt"
    if not path.exists():
        print("  NOT FOUND")
        return

    entries = []
    with open(path, encoding='utf-8') as f:
        header = f.readline()
        for line in f:
            line = line.strip('\n')
            if not line or line.startswith('#'):
                continue
            # Space-delimited; split on 2+ consecutive spaces
            parts = re.split(r'\s{2,}', line)
            if len(parts) < 13:
                continue
            ch = parts[0].strip()
            if not ch or not CJK_RE.match(ch):
                continue
            # Parse individual columns (first part may need space-splitting)
            cols = parts[0].split()  # first column group is space-delimited
            if len(cols) < 8:
                continue
            ch = cols[0]
            entry = {
                "c": ch,
                "i": cols[1] if len(cols) > 1 else "",     # 廣韻聲
                "r": cols[2] if len(cols) > 2 else "",     # 廣韻韻
                "t": cols[3] if len(cols) > 3 else "",     # 聲調
                "d": cols[4] if len(cols) > 4 else "",     # 等
                "ok": cols[6] if len(cols) > 6 else "",    # 開合
                "p1": parts[1].strip() if len(parts) > 1 else "",   # 擬音
                "p2": parts[2].strip() if len(parts) > 2 else "",   # 擬音2
                "n": parts[-1].strip() if len(parts) > 3 else "",   # 註釋
            }
            entries.append(entry)

    save_json("zhengzhang_oc", entries)
    print(f"  {len(entries)} entries")

# ─── T2.5: Character normalization (正字) ───
def parse_zhengzi():
    print("\n=== T2.5: Parsing 正字.tsv ===")
    copy_if_needed("tools/tables/data/正字.tsv", "正字.tsv")
    path = RAW_MCP / "正字.tsv"
    if not path.exists():
        print("  NOT FOUND")
        return

    zhengzi = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) >= 2 and parts[0] and parts[1]:
                variant = parts[0].strip()
                standards = parts[1].strip().split()
                if variant not in zhengzi:
                    zhengzi[variant] = standards

    save_json("zhengzi_map", zhengzi)
    print(f"  {len(zhengzi)} variant → standard mappings")

# ─── T2.6: Nüshu data ───
def parse_nushu():
    print("\n=== T2.6: Parsing Nüshu data ===")
    copy_if_needed("tools/tables/data/nsbzzzd.csv", "nsbzzzd.csv")
    path = RAW_MCP / "nsbzzzd.csv"
    if not path.exists():
        print("  NOT FOUND")
        return

    nushu = []
    with open(path, encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 3:
                continue
            nushu.append({
                "n": row[0].strip(),  # 女书字符
                "c": row[1].strip(),  # 对应汉字
                "r": row[2].strip(),  # 江永方言发音
            })

    save_json("nushu", nushu)
    print(f"  {len(nushu)} Nüshu entries")

# ─── T3.7: Unihan extra fields ───
def parse_unihan_extra():
    print("\n=== T3.7: Parsing Unihan dictionary-like data ===")
    copy_if_needed("tools/tables/data/Unihan_DictionaryLikeData.txt", "Unihan_DictionaryLikeData.txt")
    path = RAW_MCP / "Unihan_DictionaryLikeData.txt"
    if not path.exists():
        print("  NOT FOUND")
        return

    # Extract: kCangjie, kFourCornerCode, kTotalStrokes, kGradeLevel
    fields = {
        "kCangjie": "cj",
        "kFourCornerCode": "fc",
        "kTotalStrokes": "ts",
        "kGradeLevel": "gl",
        "kHanyuPinlu": "pl",
        "kXHC1983": "xh",
    }

    char_data: dict[str, dict] = defaultdict(dict)
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            code = parts[0].strip().removeprefix('U+')
            field = parts[1].strip()
            value = parts[2].strip()
            if field in fields:
                try:
                    ch = chr(int(code, 16))
                    char_data[ch][fields[field]] = value
                except:
                    continue

    result = dict(char_data)
    save_json("unihan_extra", result)
    print(f"  {len(result)} characters with extra fields")

# ─── T3.8: RIME dicts ───
def parse_rime_dicts():
    print("\n=== T3.8: Parsing RIME dictionaries ===")
    rime_files = {
        "jyut6ping3.dict.yaml": "ct_rime",
        "langjin.dict.yaml": "nj_rime",
        "bepemefeve.dict.yaml": "lg_rime",
    }
    results = {}
    for fname, key in rime_files.items():
        path = MCP_DIR / "tools" / "tables" / "data" / fname
        if not path.exists():
            continue
        entries: dict[str, str] = {}
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('.'):
                    continue
                parts = line.split('\t')
                if len(parts) >= 2:
                    word = parts[0].strip()
                    reading = parts[1].strip()
                    if word and CJK_RE.search(word):
                        entries[word] = reading
        results[key] = entries
        print(f"  {fname}: {len(entries)} entries")

    if results:
        save_json("rime_readings", results)

# ─── T3.9: Ningpo Syllabary ───
def parse_ningpo():
    print("\n=== T3.9: Parsing Ningpo Syllabary 1851 ===")
    copy_if_needed("tools/tables/data/The_Ningpo_Syllabary-ipa.tsv", "ningpo.tsv")
    path = RAW_MCP / "ningpo.tsv"
    if not path.exists():
        print("  NOT FOUND")
        return

    entries = {}
    with open(path, encoding='utf-8') as f:
        f.readline()
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) >= 2:
                ch = parts[0].strip()
                reading = parts[1].strip()
                if ch and CJK_RE.search(ch) and reading:
                    entries[ch] = reading

    save_json("ningpo", entries)
    print(f"  {len(entries)} entries")

# ─── T3.11: Korean Woosun ───
def parse_woosun():
    print("\n=== T3.11: Parsing Korean Woosun ===")
    copy_if_needed("tools/tables/data/woosun-sin.csv", "woosun-sin.csv")
    path = RAW_MCP / "woosun-sin.csv"
    if not path.exists():
        print("  NOT FOUND")
        return

    entries = []
    with open(path, encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 5:
                continue
            entries.append({
                "h": row[0].strip(),  # hanja
                "i": row[1].strip(),  # initial
                "m": row[2].strip(),  # medial
                "f": row[3].strip(),  # final
                "k": row[4].strip(),  # hangul
                "t": row[5].strip() if len(row) > 5 else "",  # tone
            })

    save_json("woosun", entries)
    print(f"  {len(entries)} entries")

# ─── T3.10: IVD glyph variants ───
def parse_ivd():
    print("\n=== T3.10: Parsing IVD glyph variants ===")
    # StandardizedVariants.txt
    copy_if_needed("tools/tables/data/StandardizedVariants.txt", "StandardizedVariants.txt")
    path = RAW_MCP / "StandardizedVariants.txt"
    if not path.exists():
        print("  NOT FOUND")
        return

    variants: dict[str, list[str]] = defaultdict(list)
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            base = parts[0].strip()
            var = parts[2].strip()
            if CJK_RE.search(base):
                variants[base].append(var)

    save_json("ivd_variants", dict(variants))
    print(f"  {len(variants)} base chars with glyph variants")
    print(f"  {sum(len(v) for v in variants.values())} total variant sequences")

# ─── Main ───
def main():
    print("=== Preprocessing MCPDict Data v4 ===\n")
    RAW_MCP.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

    # Tier 1
    try:
        aggregate_dialect_readings()
    except Exception as e:
        print(f"  ERROR T1.1: {e}")

    try:
        parse_moe_dict()
    except Exception as e:
        print(f"  ERROR T1.2: {e}")

    try:
        enrich_dialect_metadata()
    except Exception as e:
        print(f"  ERROR T1.3: {e}")

    # Tier 2
    try:
        parse_zhengzhang()
    except Exception as e:
        print(f"  ERROR T2.4: {e}")

    try:
        parse_zhengzi()
    except Exception as e:
        print(f"  ERROR T2.5: {e}")

    try:
        parse_nushu()
    except Exception as e:
        print(f"  ERROR T2.6: {e}")

    # Tier 3
    try:
        parse_unihan_extra()
    except Exception as e:
        print(f"  ERROR T3.7: {e}")

    try:
        parse_rime_dicts()
    except Exception as e:
        print(f"  ERROR T3.8: {e}")

    try:
        parse_ningpo()
    except Exception as e:
        print(f"  ERROR T3.9: {e}")

    try:
        parse_ivd()
    except Exception as e:
        print(f"  ERROR T3.10: {e}")

    try:
        parse_woosun()
    except Exception as e:
        print(f"  ERROR T3.11: {e}")

    print("\n=== Preprocessing v4 Complete ===")

if __name__ == '__main__':
    main()
