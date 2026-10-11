"""
compute_xx_enhancements.py — 为 ScatterView/ToneCurveView 生成小学堂增强数据

输出:
  public/data/xx_tone_summary.json  — 各方言点的调值统计（用于 ToneCurveView）
  public/data/xx_scatter_extra.json — 净新增点的散点坐标（用于 ScatterView）
"""

import json, math
from pathlib import Path
from collections import defaultdict

BASE = Path(__file__).resolve().parent.parent
PUBLIC_DATA = BASE / "public" / "data"

# Load existing data
with open(PUBLIC_DATA / "dialects.json", encoding="utf-8") as f:
    mcp = json.load(f)
mcp_points = {p["id"]: p for p in mcp["points"]}

with open(PUBLIC_DATA / "xx_overlap.json", encoding="utf-8") as f:
    overlap = json.load(f)

# ─── 1. xx_tone_summary.json ───
# For each dialect point, compute tone value statistics across all characters
# Structure: { xx_point_name: { tones: [{pitch,label,idx}], char_count: N } }
tone_data: dict[str, dict] = {}
bundle_dir = PUBLIC_DATA / "xx_bundles"
if bundle_dir.exists():
    bundles = sorted(bundle_dir.glob("*.json"))
    point_tones: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    # key: point_name → { tone_category: [tone_values] }

    for bf in bundles:
        with open(bf, encoding="utf-8") as f:
            bundle = json.load(f)
        for char_code, pt_entries in bundle.items():
            for pt_name, entries in pt_entries.items():
                for e in entries:
                    tc = e.get("tone_category", "")
                    tv = e.get("tone_value", "")
                    if tc or tv:
                        point_tones[pt_name][tc or "__none__"].append(tv or "")

    for pt_name, cat_map in point_tones.items():
        tone_list = []
        for cat, vals in sorted(cat_map.items()):
            # Parse tone values to pitch digits
            pitches = []
            for v in vals[:50]:  # sample up to 50 for avg
                try:
                    digits = [int(c) for c in v if c.isdigit()]
                    if digits:
                        pitches.append(digits)
                except:
                    pass
            if pitches:
                avg_pitch = [round(sum(g) / len(g)) for g in zip(*pitches)] if pitches else []
                tone_list.append({
                    "tone_category": cat if cat != "__none__" else "",
                    "avg_pitch": avg_pitch,
                    "count": len(vals),
                })
        if tone_list:
            tone_data[pt_name] = {"tones": tone_list, "char_count": sum(len(v) for v in cat_map.values())}

    with open(PUBLIC_DATA / "xx_tone_summary.json", "w", encoding="utf-8") as f:
        json.dump(tone_data, f, ensure_ascii=False)
    print(f"xx_tone_summary.json: {len(tone_data)} points with tone data")

# ─── 2. xx_scatter_extra.json ───
# Normalize geographic lat/lng to approximate MDS coordinate space
# by scaling relative to existing MDS coordinate range
with open(PUBLIC_DATA / "mds_coords.json", encoding="utf-8") as f:
    mds = json.load(f)

mds_ids = mds["ids"]
mds_coords = mds["coords"]
mds_groups = mds.get("groups", [])

# Find MDS coordinate range
xs = [c[0] for c in mds_coords]
ys = [c[1] for c in mds_coords]
mds_x_range = max(xs) - min(xs) if xs else 2000
mds_y_range = max(ys) - min(ys) if ys else 2000

# Find geographic range from MCPDict points
lats, lngs = [], []
for pid in mds_ids:
    p = mcp_points.get(pid)
    if p and p.get("lat") and p.get("lng"):
        lats.append(p["lat"])
        lngs.append(p["lng"])

geo_lat_range = max(lats) - min(lats) if lats else 30
geo_lng_range = max(lngs) - min(lngs) if lngs else 40

extra_points = []
for xx_name, info in overlap.items():
    mcp_id = info.get("mcp_id")
    if not mcp_id:
        # Try matching via dialects.json
        p = mcp_points.get(xx_name)
        if not p:
            # Substring search in point names/locations
            for pid, pd in mcp_points.items():
                if xx_name in pd.get("name", "") or xx_name in pd.get("location", ""):
                    p = pd
                    mcp_id = pid
                    break
        if p and p.get("lat") and p.get("lng"):
            # Scale lat/lng to MDS coordinate space
            lat_norm = (p["lat"] - min(lats)) / geo_lat_range if geo_lat_range else 0.5
            lng_norm = (p["lng"] - min(lngs)) / geo_lng_range if geo_lng_range else 0.5
            extra_points.append({
                "id": xx_name,
                "name": xx_name,
                "group": info.get("group", ""),
                "x": min(xs) + lat_norm * mds_x_range * 0.5 + lng_norm * mds_x_range * 0.5,
                "y": min(ys) + lng_norm * mds_y_range,
                "source": "小学堂",
            })

with open(PUBLIC_DATA / "xx_scatter_extra.json", "w", encoding="utf-8") as f:
    json.dump(extra_points, f, ensure_ascii=False, indent=2)
print(f"xx_scatter_extra.json: {len(extra_points)} extra scatter points")

print("Done.")
