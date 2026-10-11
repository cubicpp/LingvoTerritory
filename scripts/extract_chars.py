"""Extract rich character data from 廣韻.tsv: 字頭 + 反切 + 拟音 + 释义"""
import json, re
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).parent.parent
SRC = BASE / "data_raw" / "mcpdict" / "廣韻.tsv"
OUT = BASE / "public" / "data" / "mc_characters.json"

char_map = defaultdict(list)

with open(SRC, "r", encoding="utf-8") as f:
    headers = f.readline().strip("\n").split("\t")
    for line in f:
        parts = line.strip("\n").split("\t")
        if len(parts) < 6: continue
        desc = parts[2].strip() if len(parts) > 2 else ""
        she = parts[3].strip() if len(parts) > 3 else ""
        char = parts[1].strip() if len(parts) > 1 else ""
        fanqie = parts[7].strip() if len(parts) > 7 else ""
        reading = parts[8].strip() if len(parts) > 8 else ""
        gloss = parts[26].strip() if len(parts) > 26 else ""
        if not desc or not she or not char: continue

        m = re.match(r"^(\D+?)[一二三四]", desc)
        if not m: continue
        init = m.group(1)
        she_clean = she.replace("攝", "")
        key = f"{init}||{she_clean}"
        char_map[key].append({
            "c": char,
                "f": fanqie,
                "r": reading,
                "g": gloss,
            })

result = dict(char_map)
total = sum(len(v) for v in result.values())
OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
print(f"✅ mc_characters.json: {len(result)} keys, {total} total chars")
