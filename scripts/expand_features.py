"""
expand_features.py — 从 dialect_readings.json 的 IPA 中提取音系特征，生成 expanded_features.json
用法: python scripts/expand_features.py
输出: public/data/expanded_features.json
"""
import json, os, re
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "public", "data")

# 加载
with open(os.path.join(DATA, "dialect_readings.json"), encoding="utf-8") as f:
    dr = json.load(f)
with open(os.path.join(DATA, "dialects.json"), encoding="utf-8") as f:
    dialects = json.load(f)

# 构建 pointId → broad, name
point_info = {}
for p in dialects["points"]:
    for key in (p.get("id"), p.get("name"), p.get("title")):
        if key:
            point_info[key] = {"broad": p.get("broad", "未分类"), "name": p.get("title") or p.get("name") or ""}

# IPA 辅音提取（声母）
CONSONANT_RE = re.compile(r"[ptckbdgmnŋɴqɢʔsʃxzhlrɬʈɖɳɽʂʐɲfvθðɸβγʁjwɥɕʑʈʂʈʂʰ]+")
# IPA 元音提取（韵母核）
VOWEL_RE = re.compile(r"[iaeɛouɑɒɔəøɤɨʉɯʌæɶy]+")
# 声调标记 — match Chao tone letters, superscript digits, AND plain digits attached to syllables
TONE_RE = re.compile(r"[\u02C0-\u02DF˥˦˧˨˩꜀꜁꜂꜃¹²³⁴⁵0-9]")

def extract_tones(ipa_str: str) -> set:
    """提取声调符号为标准化单字符"""
    tones = set()
    for m in TONE_RE.finditer(ipa_str):
        tones.add(m.group())
    return tones

# 按 point 统计
point_data = defaultdict(lambda: {"consonants": set(), "vowels": set(), "tones": set(), "sample_count": 0})

for ch, readings in dr.get("charIndex", {}).items():
    for r in readings:
        pid = r.get("pointId") or r.get("pointName") or ""
        info = point_info.get(pid)
        if not info:
            continue
        ipa = r.get("reading", "")
        if not ipa:
            continue
        pd = point_data[pid]
        pd["sample_count"] += 1
        pd["consonants"].update(CONSONANT_RE.findall(ipa))
        pd["vowels"].update(VOWEL_RE.findall(ipa))
        pd["tones"].update(extract_tones(ipa))

# 筛选至少有 10 条 IPA 记录的点
MIN_SAMPLES = 10
features = ["声母数", "韵母数", "声调数"]
ids = []
names = []
groups = []
matrix = []

for pid, pd in point_data.items():
    if pd["sample_count"] < MIN_SAMPLES:
        continue
    info = point_info.get(pid)
    if not info:
        continue
    ids.append(pid)
    names.append(info["name"] or pid)
    # Map broad to English group name for GROUP_TO_BROAD compatibility
    broad = info["broad"]
    eng_map = {
        "官话": "Mandarin", "吴语": "Wu", "粤语": "Yue", "闽语": "Min",
        "客家话": "Hakka", "湘语": "Xiang", "赣语": "Gan",
        "晋语": "Mandarin", "徽语": "Wu", "平话土话": "Yue",
        "标准语": "Mandarin", "乡话": "Xiang",
        "戏曲音": "Mandarin", "域外方音": "Yue",
        "民族语": "Min", "未分类": "Mandarin",
    }
    groups.append(eng_map.get(broad, broad))
    matrix.append([len(pd["consonants"]), len(pd["vowels"]), len(pd["tones"])])

out = {
    "features": features,
    "ids": ids,
    "names": names,
    "groups": groups,
    "matrix": matrix,
}

out_path = os.path.join(DATA, "expanded_features.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"Generated {out_path}")
print(f"  Points: {len(ids)}")
print(f"  Broads: {len(set(groups))}")
for g in sorted(set(groups)):
    cnt = groups.count(g)
    print(f"    {g}: {cnt}")
