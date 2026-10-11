"""
preprocess_v5.py — Tier 4-5: CJK readings, char metadata, historical layers, phonology descriptions
"""
import json
import re
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
MCP_DIR = BASE_DIR.parent / "MCPDict"
RAW_MCP = BASE_DIR / "data_raw" / "mcpdict"
PUBLIC_DATA = BASE_DIR / "public" / "data"

CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\u2f800-\u2fa1f]")

def compact_json(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'))

def save_json(name, data):
    p = PUBLIC_DATA / f"{name}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(compact_json(data))
    kb = p.stat().st_size / 1024
    print(f"  -> {name}.json ({kb:.0f} KB)")

def parse_simple_tsv(filename):
    """Parse MCPDict output TSV format: #漢字\t音標\t解釋"""
    path = RAW_MCP / filename
    if not path.exists():
        print(f"  MISS: {filename}")
        return {}
    entries: dict[str, list[str]] = defaultdict(list)
    count = 0
    with open(path, encoding='utf-8') as f:
        header = f.readline()
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            ch = parts[0].strip()
            if not ch or not CJK_RE.search(ch):
                continue
            reading = parts[1].strip()
            if reading:
                entries[ch].append(reading)
                count += 1
    print(f"  {filename}: {len(entries)} chars, {count} entries")
    return dict(entries)

def parse_simple_tsv_single(filename):
    """Parse TSV where each char has one reading (deduplicated)"""
    path = RAW_MCP / filename
    if not path.exists():
        print(f"  MISS: {filename}")
        return {}
    entries: dict[str, str] = {}
    count = 0
    with open(path, encoding='utf-8') as f:
        header = f.readline()
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            ch = parts[0].strip()
            if not ch or not CJK_RE.search(ch):
                continue
            reading = parts[1].strip()
            if reading and ch not in entries:
                entries[ch] = reading
                count += 1
    print(f"  {filename}: {len(entries)} chars, {count} entries")
    return entries

# ─── V1: CJK Cross-Language Readings ───
def parse_cjk_readings():
    print("\n=== V1: CJK Cross-Language Readings ===")
    jp_kanon = parse_simple_tsv("日語漢音.tsv")
    jp_goon = parse_simple_tsv("日語吳音.tsv")
    jp_touon = parse_simple_tsv("日語唐音.tsv")
    jp_kanyouon = parse_simple_tsv("日語慣用音.tsv")
    ko = parse_simple_tsv("朝鮮.tsv")
    vi = parse_simple_tsv("越南.tsv")

    # Merge into unified char index
    all_chars = set()
    all_chars.update(jp_kanon.keys(), jp_goon.keys(), jp_touon.keys(), jp_kanyouon.keys(), ko.keys(), vi.keys())

    char_index: dict[str, dict[str, list[str]]] = {}
    for ch in all_chars:
        entry: dict[str, list[str]] = {}
        if ch in jp_kanon: entry["ja_kanon"] = jp_kanon[ch]
        if ch in jp_goon: entry["ja_goon"] = jp_goon[ch]
        if ch in jp_touon: entry["ja_touon"] = jp_touon[ch]
        if ch in jp_kanyouon: entry["ja_kanyouon"] = jp_kanyouon[ch]
        if ch in ko: entry["ko"] = ko[ch]
        if ch in vi: entry["vi"] = vi[ch]
        if entry:
            char_index[ch] = entry

    lang_names = {
        "ja_kanon": "日語漢音",
        "ja_goon": "日語吳音",
        "ja_touon": "日語唐音",
        "ja_kanyouon": "日語慣用音",
        "ko": "朝鮮語",
        "vi": "越南語",
    }
    save_json("cjk_readings", {"charIndex": char_index, "langNames": lang_names})
    return char_index

# ─── V2: Old National Pronunciation ───
def parse_laoguoyin():
    print("\n=== V2: Old National Pronunciation ===")
    data = parse_simple_tsv("老國音.tsv")
    save_json("laoguoyin", data)
    return data

# ─── V3: Menggu Ziyun ('Phags-pa script) ───
def parse_mengguziyun():
    print("\n=== V3: Menggu Ziyun ===")
    path = RAW_MCP / "蒙古字韻.tsv"
    if not path.exists():
        print("  MISS: 蒙古字韻.tsv")
        return

    entries = []
    with open(path, encoding='utf-8') as f:
        f.readline()
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            ch = parts[0].strip()
            if not ch or not CJK_RE.search(ch):
                continue
            reading = parts[1].strip()
            comment = parts[2].strip() if len(parts) > 2 else ""
            entry = {"c": ch, "r": reading}
            if comment:
                # Split 'Phags-pa chars from gloss
                phags = re.split(r'\s+', comment, 1)
                entry["p"] = phags[0].strip()
                if len(phags) > 1:
                    entry["g"] = phags[1].strip()
            entries.append(entry)

    save_json("mengguziyun", entries)
    print(f"  {len(entries)} entries")

# ─── V4: Character Metadata (strokes, radical, classification) ───
def parse_char_metadata():
    print("\n=== V4: Character Metadata ===")
    strokes = parse_simple_tsv_single("總筆畫數.tsv")
    radical_res = parse_simple_tsv_single("部首餘筆.tsv")
    grade = parse_simple_tsv_single("分類.tsv")

    all_chars = set(strokes.keys()) | set(radical_res.keys()) | set(grade.keys())

    meta: dict[str, dict] = {}
    for ch in all_chars:
        entry: dict = {}
        if ch in strokes:
            try:
                entry["s"] = int(strokes[ch])
            except:
                pass
        if ch in radical_res:
            val = radical_res[ch]
            # Format: "部首N" e.g. "一4" means radical 一 + 4 residual
            m = re.match(r'^(.+?)(\d*)$', val)
            if m:
                entry["r"] = m.group(1)  # radical char
                if m.group(2):
                    entry["rs"] = int(m.group(2))  # residual strokes
        if ch in grade:
            entry["g"] = grade[ch]
        if entry:
            meta[ch] = entry

    save_json("char_meta", meta)
    print(f"  {len(meta)} characters with metadata")

# ─── V5: Input Method Encodings ───
def parse_ime_codes():
    print("\n=== V5: Input Method Encodings ===")
    wubi86 = parse_simple_tsv_single("五筆86.tsv")
    wubi98 = parse_simple_tsv_single("五筆98.tsv")
    cangjie3 = parse_simple_tsv_single("倉頡三代.tsv")
    cangjie5 = parse_simple_tsv_single("倉頡五代.tsv")

    all_chars = set(wubi86.keys()) | set(wubi98.keys()) | set(cangjie3.keys()) | set(cangjie5.keys())

    ime: dict[str, dict] = {}
    for ch in all_chars:
        entry: dict = {}
        if ch in wubi86: entry["wb86"] = wubi86[ch]
        if ch in wubi98: entry["wb98"] = wubi98[ch]
        if ch in cangjie3: entry["cj3"] = cangjie3[ch]
        if ch in cangjie5: entry["cj5"] = cangjie5[ch]
        if entry:
            ime[ch] = entry

    save_json("ime_codes", ime)
    print(f"  {len(ime)} characters with IME codes")

# ─── V6: Phonology Descriptions from _詳情.json ───
def extract_phonology_descriptions():
    print("\n=== V6: Phonology System Descriptions ===")
    xq_path = MCP_DIR / "tools" / "tables" / "output" / "_詳情.json"
    if not xq_path.exists():
        print("  MISS: _詳情.json")
        return

    with open(xq_path, encoding='utf-8') as f:
        xq = json.load(f)

    with open(PUBLIC_DATA / "dialects.json", encoding='utf-8') as f:
        dialects = json.load(f)

    points = dialects.get("points", [])

    # Build lookup: name -> _詳情 key
    lookup: dict[str, dict] = {}
    for key, info in xq.items():
        jc = info.get("簡稱", "")
        yy = info.get("語言", "")
        if jc:
            lookup[jc] = info
        if yy:
            lookup[yy] = info

    phono_desc: dict[str, str] = {}
    enriched = 0
    for p in points:
        info = lookup.get(p.get("name", "")) or lookup.get(p.get("title", ""))
        if not info:
            n = p.get("name", "").rstrip("话話方言方言")
            info = lookup.get(n)
        if info:
            desc = info.get("音系說明", "")
            if desc and len(desc) > 5:
                phono_desc[p["id"]] = desc
                p["phonoDesc"] = desc
                enriched += 1

    # Write back enriched dialects
    with open(PUBLIC_DATA / "dialects.json", 'w', encoding='utf-8') as f:
        json.dump(dialects, f, ensure_ascii=False)
    print(f"  Enriched {enriched}/{len(points)} with phonoDesc")

    save_json("phono_desc", phono_desc)
    return phono_desc

# ─── V7: Guangyun Full ───
def parse_guangyun_full():
    print("\n=== V7: Guangyun Full Data ===")
    path = RAW_MCP / "廣韻.tsv"
    if not path.exists():
        print("  MISS: 廣韻.tsv")
        return

    entries = []
    with open(path, encoding='utf-8') as f:
        reader = __import__('csv').reader(f, delimiter='\t')
        header = next(reader)
        for row in reader:
            if len(row) < 5:
                continue
            ch = row[1].strip() if len(row) > 1 else ""
            if not ch or not CJK_RE.search(ch):
                continue
            entries.append({
                "c": ch,
                "xy": row[0].strip() if len(row) > 0 else "",    # 小韻
                "i": row[2].strip() if len(row) > 2 else "",     # 聲母
                "r": row[3].strip() if len(row) > 3 else "",     # 韻母
                "t": row[4].strip() if len(row) > 4 else "",     # 聲調
                "g": row[11].strip() if len(row) > 11 else "",   # 釋義
            })

    save_json("guangyun_full", entries)
    print(f"  {len(entries)} entries")

# ─── Main ───
def main():
    print("=== Preprocessing MCPDict Data v5 ===\n")
    RAW_MCP.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

    try:
        parse_cjk_readings()
    except Exception as e:
        print(f"  ERROR V1: {e}")
        import traceback; traceback.print_exc()

    try:
        parse_laoguoyin()
    except Exception as e:
        print(f"  ERROR V2: {e}")

    try:
        parse_mengguziyun()
    except Exception as e:
        print(f"  ERROR V3: {e}")

    try:
        parse_char_metadata()
    except Exception as e:
        print(f"  ERROR V4: {e}")

    try:
        parse_ime_codes()
    except Exception as e:
        print(f"  ERROR V5: {e}")

    try:
        extract_phonology_descriptions()
    except Exception as e:
        print(f"  ERROR V6: {e}")

    try:
        parse_guangyun_full()
    except Exception as e:
        print(f"  ERROR V7: {e}")

    print("\n=== Preprocessing v5 Complete ===")

if __name__ == '__main__':
    main()
