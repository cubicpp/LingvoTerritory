"""
generate_wordclouds.py — 为每个方言大类生成词云 PNG
用法: python scripts/generate_wordclouds.py
输出: public/wordclouds/{broad}.png
统计: 按方言点计频 + 通用字抑制 = 突出方言特征字
"""
import json
import re
import os
from collections import defaultdict
from wordcloud import WordCloud

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "public", "data")
OUT_DIR = os.path.join(BASE, "public", "wordclouds")
FONT_PATH = os.path.join(BASE, "public", "fonts", "plangothicp1.otf")

with open(os.path.join(DATA_DIR, "dialect_readings.json"), encoding="utf-8") as f:
    dr = json.load(f)
with open(os.path.join(DATA_DIR, "dialects.json"), encoding="utf-8") as f:
    dialects = json.load(f)

point_to_broad: dict[str, str] = {}
for p in dialects["points"]:
    for key in (p.get("id"), p.get("name"), p.get("title")):
        if key:
            point_to_broad[key] = p.get("broad", "未分类")

CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
DIGIT_RE = re.compile(r"^[0-9〇一二三四五六七八九十百千万亿]+$")

# broad_freq[category][char] = 方言点收录数
broad_freq: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
# char_total_freq[char] = 总收录数（跨所有大类）
char_total_freq: dict[str, int] = defaultdict(int)

for ch, readings in dr.get("charIndex", {}).items():
    if not CJK_RE.search(ch) or DIGIT_RE.match(ch):
        continue
    seen_broads: set[str] = set()
    for r in readings:
        pid = r.get("pointId") or r.get("pointName") or ""
        b = point_to_broad.get(pid)
        if b and b != "未分类":
            broad_freq[b][ch] += 1
            char_total_freq[ch] += 1
            seen_broads.add(b)

BROAD_CATEGORIES = [
    "官话", "吴语", "粤语", "闽语", "客家话", "湘语", "赣语",
    "晋语", "徽语", "平话土话", "标准语", "乡话", "戏曲音",
    "域外方音", "民族语",
]

BROAD_COLORS = {
    "官话": (196, 58, 49), "吴语": (74, 124, 89), "粤语": (212, 146, 106),
    "闽语": (232, 180, 74), "客家话": (123, 158, 109), "湘语": (142, 107, 79),
    "赣语": (107, 142, 138), "晋语": (192, 128, 96), "徽语": (160, 144, 128),
    "平话土话": (176, 160, 128), "标准语": (61, 50, 38),
    "乡话": (154, 138, 106), "戏曲音": (212, 160, 160),
    "域外方音": (96, 128, 160), "民族语": (128, 160, 96),
}

os.makedirs(OUT_DIR, exist_ok=True)

total_broads = sum(1 for b in BROAD_CATEGORIES if broad_freq.get(b))

for broad in BROAD_CATEGORIES:
    raw = broad_freq.get(broad, {})
    if not raw:
        print(f"  [跳过] {broad} — 无数据")
        continue

    # 权重 = sqrt(频次) × (本类频次 / 总频次) — 频次开方抑制极端值，比率突出特征性
    filtered: list[tuple[str, float]] = []
    for ch, cnt in raw.items():
        total = char_total_freq.get(ch, cnt)
        ratio = cnt / total  # 0~1, 越接近1越专属于本类
        score = (cnt ** 0.5) * ratio
        filtered.append((ch, score))

    filtered.sort(key=lambda x: -x[1])
    filtered = filtered[:250]

    if not filtered:
        print(f"  [跳过] {broad} — 过滤后无数据")
        continue

    # 转为 {word: weight}
    freq_dict = {ch: w for ch, w in filtered}

    wc = WordCloud(
        width=800, height=600, font_path=FONT_PATH,
        background_color=None, mode="RGBA",
        max_words=200, relative_scaling=0.5,
        prefer_horizontal=0.7, min_font_size=10, margin=8,
        color_func=lambda *args, **kwargs: BROAD_COLORS.get(broad, (160, 160, 160)),
    )
    wc.generate_from_frequencies(freq_dict)

    out_path = os.path.join(OUT_DIR, f"{broad}.png")
    wc.to_file(out_path)
    top5 = ", ".join(f"{c}" for c, _ in filtered[:5])
    print(f"  [OK] {broad} → {len(freq_dict)} 特征字 → {out_path}")
    print(f"        Top5: {top5}")

print("完成。")
