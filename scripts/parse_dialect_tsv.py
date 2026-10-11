"""
parse_dialect_tsv.py — Parse downloaded dialect TSV files and produce dialect_readings.json
Handles multiple TSV formats auto-detected from headers.
Reads TSVs from data_raw/mcpdict/dialects/, matches to dialect_v2.json points,
outputs public/data/dialect_readings.json
"""
import csv
import json
import re
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
TSV_DIR = BASE_DIR / "data_raw" / "mcpdict" / "dialects"
V2_PATH = BASE_DIR / "public" / "data" / "dialects.json"
OUT_PATH = BASE_DIR / "public" / "data" / "dialect_readings.json"

CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]")
IPA_CHAR_RE = re.compile(r"[a-zA-Zɑɒæɐɔɘəɛɜɞɤɨɪɯɵɶɷɹɺɻɽɾʀʁəɚɝɞʋʌʍʎʏɓɕɗɖɘɚɝɞɟɠɡɢɣɤɥɦɧɨɩɪɫɬɭɮɯɰɱɲɳɴŋɵɸɹɺɻɽɾɿʀʁʂʃʄʅʆʇʈʉʋʌʍʎʏʐʑʒʓʔʕʖʗʘʙʚʛʜʝʞʟʠʡʢʣʤʥʧʨʩʪʫʬʭʮʯ\ueab0-\ueabf\u0300-\u036f\u02b0-\u02ff\u1dc0-\u1dff\u20d0-\u20ff\u0363-\u036f\uab50-\uab7f˥˦˧˨˩ᵝᶣʷʲˤˠⁿˡⁿˤʰ̴̥̬̹̜̟̠̩̪̯̰̈̽̃̚ⁿ̴̥̬̹̜̟̠̩̪̯̰̈̽̊̃̚̚∅φθχψωø↑↓→←↗↘'ˈˌ|‖.‿#\-\d\[\]\(\)\{\}~]+")


def load_points() -> list[dict]:
    with open(V2_PATH, "r", encoding="utf-8") as f:
        return json.load(f).get("points", [])


def match_points(tsv_base: str, points: list[dict]) -> list[dict]:
    """Match a TSV base name (stem) to dialect points."""
    matched: list[dict] = []

    # Name normalization: strip year prefixes and date suffixes
    clean = re.sub(r"^\d{4}[s]?", "", tsv_base)
    clean = re.sub(r"[\d\-_.].*$", "", clean)
    clean = clean.strip()

    for p in points:
        pid = p.get("id", "")
        pt = p.get("title", "")
        pn = p.get("name", "")
        pl = p.get("location", "")

        if pid == clean or pt == clean:
            matched.append(p)
            continue

        name_clean = pn.rstrip("话話方言")
        if name_clean == clean:
            matched.append(p)
            continue

        if clean in pl or clean in pid or clean in pt:
            matched.append(p)
            continue

    # Broader: substring in location or title
    if not matched and len(clean) >= 2:
        for p in points:
            if clean[:2] in p.get("location", "") or clean[:2] in p.get("title", ""):
                matched.append(p)
                break

    # For group names: match broad category
    if not matched and clean in ("客家",):
        for p in points:
            if p.get("broad") == "客家话":
                matched.append(p)

    return matched


def parse_inline_beijing(filepath: Path) -> dict[str, str]:
    """Format: single column per row with IPA prefix followed by characters.
    Example: tsɿ55资姿咨兹...
    Extract IPA prefix and assign to each following CJK character.
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Find where IPA ends and Chinese chars begin
            # Split at first CJK character
            m = CJK_RE.search(line)
            if not m:
                continue
            idx = m.start()
            ipa = line[:idx].strip()
            chars = line[idx:]
            # Extract individual Chinese characters (skip annotations in {})
            chars_clean = re.sub(r"\{[^}]*\}", "", chars)
            for ch in chars_clean:
                if CJK_RE.match(ch) and ch not in readings:
                    readings[ch] = ipa
    return readings


def parse_shanghai_format(filepath: Path) -> dict[str, str]:
    """Format: 字表\t聲母\t韻母\t聲調\t\t序號
    Reading = initial + rime + tone
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            line = line.strip("\n").strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            char = parts[0].strip()
            if not char or len(char) != 1 or not CJK_RE.match(char):
                continue
            initial = parts[1].strip() if len(parts) > 1 else ""
            rime = parts[2].strip() if len(parts) > 2 else ""
            tone = parts[3].strip() if len(parts) > 3 else ""
            reading = f"{initial}{rime}{tone}"
            if char not in readings:
                readings[char] = reading
    return readings


def parse_meihui_format(filepath: Path) -> dict[str, str]:
    """Format: 字\t源\t拼\tIPA\t...
    Reading from IPA column (index 3).
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        header = f.readline()
        cols = header.strip().split("\t")
        ipa_idx = None
        for i, c in enumerate(cols):
            if c.strip() == "IPA":
                ipa_idx = i
                break
        if ipa_idx is None:
            return readings

        for line in f:
            line = line.strip("\n").strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) <= max(0, ipa_idx):
                continue
            char = parts[0].strip()
            if not char or len(char) != 1:
                continue
            ipa = parts[ipa_idx].strip()
            if ipa and char not in readings:
                readings[char] = ipa
    return readings


def parse_dapu_format(filepath: Path) -> dict[str, str]:
    """Format: 字\t片\t区\t小片\t方言点\t声母\t韵母\t调值\t调类\t备注
    Reading = 声母 + 韵母 + 调值
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        f.readline()
        for line in f:
            line = line.strip("\n").strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 8:
                continue
            char = parts[0].strip()
            if not char or len(char) != 1 or not CJK_RE.match(char):
                continue
            sm = parts[5].strip() if len(parts) > 5 else ""
            ym = parts[6].strip() if len(parts) > 6 else ""
            tz = parts[7].strip() if len(parts) > 7 else ""
            reading = f"{sm}{ym}{tz}"
            if reading.strip() and char not in readings:
                readings[char] = reading
    return readings


def parse_taiyuan_format(filepath: Path) -> dict[str, str]:
    """Format: 聲母\t韻母\t聲調\t字元
    Characters in col 3, reading = col0 + col1 + col2
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        f.readline()
        for line in f:
            line = line.strip("\n").strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                continue
            initial = parts[0].strip()
            rime = parts[1].strip()
            tone = parts[2].strip()
            reading = f"{initial}{rime}{tone}"
            char_text = parts[3].strip() if len(parts) > 3 else ""
            for ch in char_text:
                if CJK_RE.match(ch) and ch not in readings:
                    readings[ch] = reading
    return readings


def parse_hangzhou_format(filepath: Path) -> dict[str, str]:
    """Format: Syllable-based grid. #ɿ header, then rows of:
    initial \t [tone1] chars \t \t [tone3] chars
    Extract chars and assign reading = initial + tone_value
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Find tone definitions: tone number from bracketed labels like [1], [3]
    tone_map: dict[str, str] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        parts = line.split("\t")
        for i, p in enumerate(parts):
            p = p.strip()
            if p.startswith("[") and "]" in p:
                m = re.match(r"\[(\d+)\]", p)
                if m:
                    tone_map[str(i)] = m.group(1)

    # Parse character rows
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        initial = parts[0].strip()
        if not initial or initial.startswith("[") or initial.startswith("ts"):
            # Could be an initial row
            for i in range(1, len(parts)):
                cell = parts[i].strip()
                if not cell:
                    continue
                # Remove tone marker prefix, keep only chars
                chars = re.sub(r"^\[\d+\]\s*", "", cell)
                chars = re.sub(r"\{[^}]*\}", "", chars)
                tone_key = str(i)
                tone_val = tone_map.get(tone_key, tone_key)
                for ch in chars:
                    if CJK_RE.match(ch) and ch not in readings:
                        readings[ch] = f"{initial}{tone_val}"

    return readings


def parse_xian_format(filepath: Path) -> dict[str, str]:
    """Format: index \t syllable \t tone_category \t chars
    Reading = syllable + tone_number extracted from tone_category
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        tone_values: dict[str, str] = {}
        for line in f:
            line = line.strip("\n").strip()
            if not line:
                continue
            if line.startswith("#"):
                # Parse tone line: #調值 [1]21 [2]24 [3]53 [5]44
                for m in re.finditer(r"\[(\d+)\](\d+)", line):
                    tone_values[m.group(1)] = m.group(2)
                continue

            parts = line.split("\t")
            if len(parts) < 4:
                continue

            syllable = parts[1].strip() if len(parts) > 1 else ""
            tone_cat = parts[2].strip() if len(parts) > 2 else ""
            char_text = parts[3].strip() if len(parts) > 3 else ""

            # Extract tone number from category like "陰平21"
            tm = re.search(r"(\d+)", tone_cat)
            tone_num = tm.group(1) if tm else tone_values.get(
                str(parts[0].strip()), ""
            )

            reading = f"{syllable}{tone_num}"
            for ch in char_text:
                if CJK_RE.match(ch) and ch not in readings:
                    readings[ch] = reading

    return readings


def parse_nanjing_format(filepath: Path) -> dict[str, str]:
    """Format: 阴平\t阳平\t上声\t去声\t入声
    Row 0: tone names, Row 1: tone values, Rows 2+: initial \t chars_per_tone...
    """
    readings: dict[str, str] = {}
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if len(lines) < 3:
        return readings

    tone_values = lines[1].strip().split("\t")
    tone_vals_clean = [tv.strip() for tv in tone_values]

    for line in lines[2:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        initial = parts[0].strip()
        if not initial or initial in ("ts", "tsʰ"):
            # This is actually an initial row
            if CJK_RE.match(initial):
                pass  # character row, skip
            else:
                continue

        for i in range(1, min(len(parts), len(tone_vals_clean) + 1)):
            cell = parts[i].strip() if i < len(parts) else ""
            if not cell:
                continue
            tone_val = tone_vals_clean[i - 1] if i - 1 < len(tone_vals_clean) else ""
            chars = re.sub(r"\{[^}]*\}", "", cell)
            for ch in chars:
                if CJK_RE.match(ch) and ch not in readings:
                    readings[ch] = f"{initial}{tone_val}"

    return readings


def detect_and_parse(filepath: Path) -> dict[str, str]:
    """Auto-detect format and parse accordingly."""
    with open(filepath, "r", encoding="utf-8") as f:
        header = f.readline().strip()

    # Remove BOM
    if header.startswith("\ufeff"):
        header = header[1:]

    parts = header.split("\t")

    # Detect format
    if "字表" in header and "聲母" in header:
        return parse_shanghai_format(filepath)
    if "IPA" in parts:
        return parse_meihui_format(filepath)
    if "字" == parts[0].strip() and "声母" in header:
        return parse_dapu_format(filepath)
    if "聲母" == parts[0].strip() and "字元" in header:
        return parse_taiyuan_format(filepath)
    if "阴平" in header and "阳平" in header:
        return parse_nanjing_format(filepath)

    # Try inline format detection: single column, IPA prefix + CJK chars
    with open(filepath, "r", encoding="utf-8") as f:
        lines = [f.readline().strip() for _ in range(5)]
        lines = [l for l in lines if l and not l.startswith("#")]

    # Check if lines follow inline IPA+chars pattern
    inline_count = 0
    for line in lines[:5]:
        parts = line.split("\t")
        if len(parts) == 1:
            m = IPA_CHAR_RE.match(line)
            if m and CJK_RE.search(line):
                inline_count += 1

    if inline_count >= 2 and len(lines) > 0 and len(lines[0].split("\t")) == 1:
        return parse_inline_beijing(filepath)

    # Try 杭州/西安 format: has tone definitions in # lines
    with open(filepath, "r", encoding="utf-8") as f:
        all_text = f.read()
    if "#ɿ" in all_text or "陰平" in all_text or "阴平" in all_text:
        if re.search(r"#調值|#调值|#調值", all_text):
            return parse_xian_format(filepath)
        if "ts" in all_text[:200] and "tsʰ" in all_text[:200]:
            return parse_hangzhou_format(filepath)

    return {}


def try_extract_comments(filepath: Path) -> dict[str, str]:
    """Generic comment extraction: try to read last column as a comment for each character.
    Works for formats with extra columns after the reading data.
    Only returns comments that look like semantic glosses (containing CJK text).
    """
    comments: dict[str, str] = {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if len(lines) < 2:
            return comments

        # Detect column count from first data line
        first_line = lines[1].strip() if len(lines) > 1 else ""
        col_count = len(first_line.split("\t"))

        for line in lines[1:]:
            line = line.strip("\n").strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")

            # Try columns that might contain comments
            comment = ""
            for ci in range(max(4, col_count - 1), col_count):
                if ci < len(parts):
                    cell = parts[ci].strip()
                    # Check if cell looks like a comment (contains CJK text, not just IPA/symbols)
                    if CJK_RE.search(cell) and len(cell) > 1:
                        comment = cell
                        break

            if not comment:
                continue

            # Find character in first column(s)
            char = parts[0].strip() if len(parts) > 0 else ""
            if len(char) == 1 and CJK_RE.match(char):
                if char not in comments:
                    comments[char] = comment
            elif len(char) > 1:
                # Multi-char field - extract first CJK char
                for ch in char:
                    if CJK_RE.match(ch):
                        if ch not in comments:
                            comments[ch] = comment
                        break
    except Exception:
        pass
    return comments


def main():
    print("=== Parsing Dialect TSV Files ===\n")

    points = load_points()
    print(f"Loaded {len(points)} points from dialects.json")

    tsv_files = sorted(TSV_DIR.glob("*.tsv"))
    if not tsv_files:
        print(f"❌ No TSV files found in {TSV_DIR}")
        print("   Run fetch_mcpdict_tsv.py first")
        return

    print(f"Found {len(tsv_files)} TSV files\n")

    char_index: dict[str, list[dict]] = defaultdict(list)
    ok = 0
    fail_parse = 0
    fail_match = 0

    for tsv_path in tsv_files:
        base = tsv_path.stem
        matched = match_points(base, points)

        if not matched:
            fail_match += 1
            print(f"  [{base}] No matching dialect point")
            continue

        readings = detect_and_parse(tsv_path)
        if not readings:
            fail_parse += 1
            print(f"  [{base}] Could not parse (unknown format)")
            continue

        # Second pass: try to extract comments/glosses from last column
        comments = try_extract_comments(tsv_path)

        for char, reading in readings.items():
            reading = reading.replace(" ", "")
            for mp in matched:
                entry: dict = {
                    "pointId": mp["id"],
                    "reading": reading,
                    "pointName": mp["name"],
                }
                if char in comments:
                    entry["comment"] = comments[char]
                char_index[char].append(entry)

        ok += 1
        pt_names = ", ".join(m["id"] for m in matched[:3])
        if len(matched) > 3:
            pt_names += f" (+{len(matched)-3})"
        print(f"  [{base}] → {len(matched)} point(s) [{pt_names}], {len(readings)} chars")

    print(f"\n=== Results ===")
    print(f"  Parsed OK: {ok}")
    print(f"  Failed parse: {fail_parse} (unknown format)")
    print(f"  Failed match: {fail_match} (no dialect point)")
    print(f"  Total TSV files: {len(tsv_files)}")

    output = {"charIndex": dict(char_index)}
    total_chars = len(output["charIndex"])
    total_entries = sum(len(v) for v in output["charIndex"].values())

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)
    print(f"\n✅ Wrote {OUT_PATH}")
    print(f"   {total_chars} unique characters, {total_entries} total readings")
    print(f"   {OUT_PATH.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
