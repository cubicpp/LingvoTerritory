import json
import math
import os
from collections import Counter, defaultdict
from typing import Any


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
OUT = os.path.join(DATA, "insights")


def load_json(name: str) -> Any:
    with open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(name: str, data: Any) -> None:
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def finite_number(value: Any, fallback: float = 0.0) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return fallback
    return v if math.isfinite(v) else fallback


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))


def parse_pitch(raw: str) -> list[int]:
    digits = [int(ch) for ch in str(raw or "") if ch.isdigit()]
    return [n for n in digits if 1 <= n <= 5]


def point_tone_count(point: dict[str, Any]) -> int:
    raw = point.get("toneSystem")
    if not raw:
        return 0
    try:
        tones = json.loads(raw)
    except Exception:
        return 0
    count = 0
    for value in tones.values():
        if isinstance(value, list) and value and parse_pitch(value[0]):
            count += 1
    return count


def build_point_reading_counts(dr_data: dict[str, Any]) -> Counter:
    counts: Counter = Counter()
    for readings in dr_data.get("charIndex", {}).values():
        for item in readings:
            key = item.get("pointId") or item.get("pointName")
            if key:
                counts[key] += 1
    return counts


def build_group_stats(points: list[dict[str, Any]], reading_counts: Counter) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for point in points:
        grouped[point.get("broad") or "未分类"].append(point)

    groups = []
    for broad, members in grouped.items():
        coords = [
            (finite_number(p.get("lat")), finite_number(p.get("lng")))
            for p in members
            if finite_number(p.get("lat")) and finite_number(p.get("lng"))
        ]
        provinces = Counter(p.get("adminProvince") or p.get("region") or "未知" for p in members)
        span = 0.0
        if len(coords) >= 2:
            lats = [c[0] for c in coords]
            lngs = [c[1] for c in coords]
            span = haversine_km(min(lats), min(lngs), max(lats), max(lngs))
        coverage_values = [
            reading_counts.get(p.get("id"), 0)
            or reading_counts.get(p.get("name"), 0)
            or reading_counts.get(p.get("title"), 0)
            for p in members
        ]
        tone_counts = [point_tone_count(p) for p in members]
        groups.append(
            {
                "broad": broad,
                "count": len(members),
                "geoSpanKm": round(span, 1),
                "topProvinces": [{"name": k, "count": v} for k, v in provinces.most_common(5)],
                "avgCharCoverage": round(sum(coverage_values) / len(members), 1) if members else 0,
                "toneCoverageRate": round(
                    sum(1 for n in tone_counts if n > 0) / len(members), 3
                )
                if members
                else 0,
                "avgToneCount": round(
                    sum(n for n in tone_counts if n > 0)
                    / max(1, sum(1 for n in tone_counts if n > 0)),
                    2,
                ),
            }
        )

    groups.sort(key=lambda item: item["count"], reverse=True)
    return {
        "totalPoints": len(points),
        "totalGroups": len(groups),
        "groups": groups,
        "largestGroups": groups[:6],
        "widestGroups": sorted(groups, key=lambda item: item["geoSpanKm"], reverse=True)[:6],
        "bestCoveredGroups": sorted(groups, key=lambda item: item["avgCharCoverage"], reverse=True)[:6],
    }


def build_mds_stats(mds: dict[str, Any], points: list[dict[str, Any]], source: str) -> dict[str, Any]:
    id_to_point = {}
    for p in points:
        for key in (p.get("id"), p.get("name"), p.get("title")):
            if key:
                id_to_point[key] = p

    coords = mds.get("coords", [])
    ids = mds.get("ids", [])
    names = mds.get("names", ids)
    groups = mds.get("groups") or [
        (id_to_point.get(pid) or {}).get("broad", "未分类") for pid in ids
    ]

    by_group: dict[str, list[tuple[int, tuple[float, float]]]] = defaultdict(list)
    for i, coord in enumerate(coords):
        if len(coord) < 2:
            continue
        by_group[groups[i] or "未分类"].append((i, (finite_number(coord[0]), finite_number(coord[1]))))

    centroids = {}
    group_rows = []
    for group, values in by_group.items():
        cx = sum(v[1][0] for v in values) / len(values)
        cy = sum(v[1][1] for v in values) / len(values)
        centroids[group] = (cx, cy)
        distances = [math.dist((cx, cy), value[1]) for value in values]
        outliers = sorted(
            [
                {
                    "id": ids[i],
                    "name": names[i] if i < len(names) else ids[i],
                    "distance": round(distances[pos], 4),
                }
                for pos, (i, _) in enumerate(values)
            ],
            key=lambda item: item["distance"],
            reverse=True,
        )[:5]
        group_rows.append(
            {
                "group": group,
                "count": len(values),
                "centroid": [round(cx, 4), round(cy, 4)],
                "intraAvgDistance": round(sum(distances) / len(distances), 4) if distances else 0,
                "outliers": outliers,
            }
        )

    for row in group_rows:
        group = row["group"]
        nearest = None
        for other, centroid in centroids.items():
            if other == group:
                continue
            distance = math.dist(centroids[group], centroid)
            if nearest is None or distance < nearest["distance"]:
                nearest = {"group": other, "distance": distance}
        row["nearestGroup"] = (
            {"group": nearest["group"], "distance": round(nearest["distance"], 4)}
            if nearest
            else None
        )

    group_rows.sort(key=lambda item: item["count"], reverse=True)
    return {
        "source": source,
        "pointCount": len(coords),
        "varianceExplained": mds.get("varianceExplained"),
        "groups": group_rows,
        "mostDiffuseGroups": sorted(
            group_rows, key=lambda item: item["intraAvgDistance"], reverse=True
        )[:6],
    }


def build_char_distinctiveness() -> dict[str, Any]:
    files = [
        ("yue", "粤语", "yue_char_freq.tsv"),
        ("min", "闽语", "minnan_freq.tsv"),
        ("wu", "吴语", "wu_freq.tsv"),
        ("chuan", "官话（四川话）", "chuan_freq.tsv"),
        ("hakka", "客家话", "hakka_freq.tsv"),
    ]
    corpora = {}
    for key, label, filename in files:
        rows = []
        path = os.path.join(DATA, filename)
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 2:
                    continue
                try:
                    rows.append((parts[0], int(parts[1])))
                except ValueError:
                    continue
        corpora[key] = {"label": label, "rows": rows}

    doc_count = max(1, len(corpora))
    df = Counter()
    for corpus in corpora.values():
        for char, _ in corpus["rows"]:
            df[char] += 1

    result = {}
    for key, corpus in corpora.items():
        rows = corpus["rows"]
        total = sum(freq for _, freq in rows) or 1
        scored = []
        for char, freq in rows:
            tf = freq / total
            idf = math.log((doc_count + 1) / (df[char] + 1)) + 1
            scored.append(
                {
                    "char": char,
                    "freq": freq,
                    "share": round(tf, 6),
                    "distinctiveness": round(tf * idf * 100000, 3),
                }
            )
        result[key] = {
            "label": corpus["label"],
            "totalChars": len(rows),
            "totalFrequency": total,
            "topFrequency": sorted(rows, key=lambda item: item[1], reverse=True)[:30],
            "topDistinctive": sorted(
                scored, key=lambda item: item["distinctiveness"], reverse=True
            )[:30],
        }
    return result


def build_phonology_stats(mc: dict[str, Any]) -> dict[str, Any]:
    initials = mc.get("initials", [])
    she = mc.get("she", [])
    matrix = mc.get("sheMatrix", [])
    cells = []
    she_totals = Counter()
    init_totals = Counter()
    empty = 0
    for i, row in enumerate(matrix):
        for j, value in enumerate(row):
            v = int(value or 0)
            if v <= 0:
                empty += 1
                continue
            init = initials[i] if i < len(initials) else str(i)
            sh = she[j] if j < len(she) else str(j)
            cells.append({"initial": init, "she": sh, "value": v})
            she_totals[sh] += v
            init_totals[init] += v
    total_cells = len(initials) * len(she)
    return {
        "totalEntries": mc.get("totalEntries"),
        "nonEmptyCells": len(cells),
        "emptyCells": empty,
        "emptyRate": round(empty / total_cells, 3) if total_cells else 0,
        "topCells": sorted(cells, key=lambda item: item["value"], reverse=True)[:12],
        "topShe": [{"name": k, "value": v} for k, v in she_totals.most_common(8)],
        "topInitials": [{"name": k, "value": v} for k, v in init_totals.most_common(8)],
    }


def build_chord_stats(dr_data: dict[str, Any], points: list[dict[str, Any]]) -> dict[str, Any]:
    point_to_broad = {}
    for p in points:
        for key in (p.get("id"), p.get("name"), p.get("title")):
            if key:
                point_to_broad[key] = p.get("broad")
    pair_counts = Counter()
    for readings in dr_data.get("charIndex", {}).values():
        broads = {
            point_to_broad.get(item.get("pointId")) or point_to_broad.get(item.get("pointName"))
            for item in readings
        }
        broads = {b for b in broads if b and b != "未分类"}
        ordered = sorted(broads)
        for i in range(len(ordered)):
            for j in range(i + 1, len(ordered)):
                pair_counts[(ordered[i], ordered[j])] += 1
    return {
        "topPairs": [
            {"source": a, "target": b, "value": value}
            for (a, b), value in pair_counts.most_common(15)
        ],
        "pairCount": len(pair_counts),
    }


def build_cluster_stats(cluster: dict[str, Any]) -> dict[str, Any]:
    mixed = []
    leaf_counts = Counter()

    def walk(node: dict[str, Any]) -> Counter:
        children = node.get("children") or []
        if not children:
            group = node.get("group") or "未知"
            leaf_counts[group] += 1
            return Counter({group: 1})
        counts = Counter()
        for child in children:
            counts.update(walk(child))
        total = sum(counts.values())
        dominant, dom_count = counts.most_common(1)[0]
        purity = dom_count / total if total else 0
        if total >= 8 and purity < 0.75:
            mixed.append(
                {
                    "name": node.get("name") or "cluster",
                    "size": total,
                    "dominantGroup": dominant,
                    "purity": round(purity, 3),
                    "groups": [{"group": k, "count": v} for k, v in counts.most_common(5)],
                    "distance": round(finite_number(node.get("distance")), 4),
                }
            )
        return counts

    walk(cluster)
    mixed.sort(key=lambda item: (item["size"], -item["purity"]), reverse=True)
    return {
        "leafGroups": [{"group": k, "count": v} for k, v in leaf_counts.most_common()],
        "mixedBranches": mixed[:12],
        "leafCount": sum(leaf_counts.values()),
    }


def build_view_insights(stats: dict[str, Any]) -> dict[str, Any]:
    groups = stats["groupStats"]
    geo = stats["mdsStats"]["geo"]
    ling = stats["mdsStats"]["ling"]
    phono = stats["phonologyStats"]
    chord = stats["chordStats"]
    cluster = stats["clusterStats"]
    chars = stats["charDistinctiveness"]

    largest = groups["largestGroups"][0]
    widest = groups["widestGroups"][0]
    diffuse_geo = geo["mostDiffuseGroups"][0]
    diffuse_ling = ling["mostDiffuseGroups"][0] if ling["mostDiffuseGroups"] else None
    top_cell = phono["topCells"][0]
    top_pair = chord["topPairs"][0] if chord["topPairs"] else None
    mixed = cluster["mixedBranches"][0] if cluster["mixedBranches"] else None
    yue_distinctive = chars.get("yue", {}).get("topDistinctive", [])[:5]

    base_limit = "数据来自公开资料整合，调查点密度、字表覆盖和来源年代并不均衡。"
    return {
        "map": {
            "viewId": "map",
            "question": "汉语方言调查点在空间上如何聚集，哪些区域只是数据覆盖更密？",
            "metrics": [
                {"label": "调查点", "value": groups["totalPoints"], "unit": "个"},
                {"label": "方言大类", "value": groups["totalGroups"], "unit": "类"},
                {"label": "最大类", "value": f'{largest["broad"]} {largest["count"]}', "unit": "点"},
            ],
            "findings": [
                f'{largest["broad"]}是样本最多的大类，占全部调查点约{round(largest["count"]/groups["totalPoints"]*100,1)}%。',
                f'{widest["broad"]}地理跨度最大，边界框跨度约{widest["geoSpanKm"]}公里。',
                "点位密度首先反映数据覆盖，不应直接等同于语言多样性。",
            ],
            "methodNote": "按《中国语言地图集》归一化大类统计点位，并用经纬度边界框估算地理跨度。",
            "limitations": base_limit,
        },
        "scatter": {
            "viewId": "scatter",
            "question": "地理距离和语音距离是否讲述同一种亲疏关系？",
            "metrics": [
                {"label": "地理MDS", "value": geo["pointCount"], "unit": "点"},
                {"label": "语音MDS", "value": ling["pointCount"], "unit": "点"},
                {"label": "地理解释率", "value": geo.get("varianceExplained", "NA"), "unit": "%"},
            ],
            "findings": [
                f'地理MDS中{diffuse_geo["group"]}类内离散度最高，说明它的空间覆盖最松散。',
                f'语音MDS只覆盖{ling["pointCount"]}个有声韵调特征的方言点，适合看相似度，不适合代表全部点位。'
                if diffuse_ling
                else "语音MDS样本较少，主要用于观察已完成声韵调切分的方言点。",
                "同一颜色气泡在两种MDS中的紧散差异，是观察迁徙、接触和内部歧异的关键。",
            ],
            "methodNote": "地理MDS使用经纬球面距离；语音MDS使用声韵调特征分布相似度。",
            "limitations": "MDS是降维投影，二维距离保留总体序次，但不能解释全部高维差异。",
        },
        "cluster": {
            "viewId": "cluster",
            "question": "传统方言分类在声韵调聚类中是否仍然稳定？",
            "metrics": [
                {"label": "聚类叶子", "value": cluster["leafCount"], "unit": "点"},
                {"label": "混合分支", "value": len(cluster["mixedBranches"]), "unit": "处"},
                {
                    "label": "最大混合支",
                    "value": mixed["dominantGroup"] if mixed else "无",
                    "unit": "",
                },
            ],
            "findings": [
                f'聚类树包含{cluster["leafCount"]}个有可比声韵调特征的方言点。',
                f'最大混合分支含{mixed["size"]}个点，主导类为{mixed["dominantGroup"]}，纯度{round(mixed["purity"]*100,1)}%。'
                if mixed
                else "当前聚类树未检测到大型低纯度混合分支。",
                "混合分支常提示方言连续体、接触区或标签体系与语音特征之间的张力。",
            ],
            "methodNote": "递归统计聚类树中每个内部节点的大类纯度，低纯度大分支被标为混合分支。",
            "limitations": "聚类只基于可比声韵调特征，不能替代完整的历史语言学分类。",
        },
        "matrix": {
            "viewId": "matrix",
            "question": "历史音系中哪些声母和韵摄组合最密集，哪些组合几乎缺席？",
            "metrics": [
                {"label": "总字次", "value": phono.get("totalEntries"), "unit": ""},
                {"label": "非空格", "value": phono["nonEmptyCells"], "unit": "格"},
                {"label": "空白率", "value": round(phono["emptyRate"] * 100, 1), "unit": "%"},
            ],
            "findings": [
                f'最高频组合是{top_cell["initial"]}+{top_cell["she"]}摄，共{top_cell["value"]}字次。',
                f'矩阵空白率约{round(phono["emptyRate"]*100,1)}%，说明声母和韵摄配合有明显音系限制。',
                f'{phono["topShe"][0]["name"]}摄总量最高，是当前热力图中最密集的韵摄之一。',
            ],
            "methodNote": "统计声母×十六摄共现矩阵，并提取最高频格、空白格和摄总量。",
            "limitations": "不同韵书的收字规模和编纂原则不同，跨书比较应看结构而非只看绝对数量。",
        },
        "sankey": {
            "viewId": "sankey",
            "question": "中古声母到韵摄的组合流量集中在哪些路径？",
            "metrics": [
                {"label": "Top路径", "value": f'{top_cell["initial"]}→{top_cell["she"]}', "unit": ""},
                {"label": "字次", "value": top_cell["value"], "unit": ""},
                {"label": "主要摄", "value": phono["topShe"][0]["name"], "unit": ""},
            ],
            "findings": [
                f'最粗路径对应{top_cell["initial"]}到{top_cell["she"]}摄，流量为{top_cell["value"]}字次。',
                "合并開合适合看总体结构，分開合适合检查更细的音韵条件。",
                "桑基图中的粗流不是演变方向，而是声母组与韵摄的共现规模。",
            ],
            "methodNote": "从中古音声母×韵摄矩阵转换为声母到摄的有权连接。",
            "limitations": "流带宽度表示共现字次，不表示历史时间上的音变流向。",
        },
        "chord": {
            "viewId": "chord",
            "question": "哪些方言大类在已收录汉字上共享最多读音记录？",
            "metrics": [
                {"label": "关系对", "value": chord["pairCount"], "unit": "组"},
                {
                    "label": "最强关系",
                    "value": f'{top_pair["source"]}-{top_pair["target"]}' if top_pair else "NA",
                    "unit": "",
                },
                {"label": "共享字", "value": top_pair["value"] if top_pair else 0, "unit": "字"},
            ],
            "findings": [
                f'共享字最多的关系是{top_pair["source"]}与{top_pair["target"]}，共有{top_pair["value"]}个字有跨类记录。'
                if top_pair
                else "当前共享字关系不足以形成稳定排序。",
                "弦图首先反映共同收录覆盖，也间接暴露数据源偏向。",
                "需要结合语音距离和聚类结果，才能判断共享记录是否代表亲疏。",
            ],
            "methodNote": "对每个汉字统计出现过读音记录的方言大类，并累加大类两两共现。",
            "limitations": "共享字数受各大类收录规模影响，不能直接等同于语言相似度。",
        },
        "tonecurve": {
            "viewId": "tonecurve",
            "question": "不同方言大类的声调数量和调值轮廓如何分化？",
            "metrics": [
                {"label": "声调数据覆盖", "value": round(largest["toneCoverageRate"] * 100, 1), "unit": "%"},
                {"label": "最大类均值", "value": largest["avgToneCount"], "unit": "调"},
                {
                    "label": "多调类",
                    "value": max(groups["groups"], key=lambda item: item["avgToneCount"])["broad"],
                    "unit": "",
                },
            ],
            "findings": [
                "声调曲线适合看轮廓形状：平、升、降、曲折，而不只是声调数量。",
                f'{max(groups["groups"], key=lambda item: item["avgToneCount"])["broad"]}的平均声调数较高，提示入声保留或调类分化更复杂。',
                "具体方言点下拉选择可检验大类平均值是否掩盖内部差异。",
            ],
            "methodNote": "解析 toneSystem 中的五度制调值，并按方言大类统计声调数量和平均轮廓。",
            "limitations": "平均曲线会压平同一大类内部的地方差异，需结合单点选择阅读。",
        },
        "dialectchar": {
            "viewId": "dialectchar",
            "question": "哪些字只是高频，哪些字真正能区分某种方言书写？",
            "metrics": [
                {"label": "语料数", "value": len(chars), "unit": "种"},
                {
                    "label": "粤语特征字",
                    "value": "、".join(item["char"] for item in yue_distinctive[:3]),
                    "unit": "",
                },
                {"label": "粤语字种", "value": chars.get("yue", {}).get("totalChars", 0), "unit": "字"},
            ],
            "findings": [
                "词云展示高频，区分度榜展示相对其它语料更有辨识度的字。",
                f'粤语当前区分度最高的一组字包括：{"、".join(item["char"] for item in yue_distinctive[:5])}。',
                "Pareto 曲线可判断少数字是否占据大部分语料频次。",
            ],
            "methodNote": "对五种方言字频做 TF-IDF 式区分度计算，同时保留原始频次排序。",
            "limitations": "语料来源、体裁和规模不同，区分度适合作探索提示，不适合作规范结论。",
        },
    }


def main() -> None:
    dialects = load_json("dialects.json")
    points = dialects.get("points", [])
    dr_data = load_json("dialect_readings.json")
    mc = load_json("mc_phonology.json")
    geo_mds = load_json("mds_coords.json")
    ling_mds = load_json("ling_mds_coords.json")
    cluster = load_json("ling_cluster.json")

    reading_counts = build_point_reading_counts(dr_data)
    stats = {
        "groupStats": build_group_stats(points, reading_counts),
        "mdsStats": {
            "geo": build_mds_stats(geo_mds, points, "geo"),
            "ling": build_mds_stats(ling_mds, points, "ling"),
        },
        "charDistinctiveness": build_char_distinctiveness(),
        "phonologyStats": build_phonology_stats(mc),
        "chordStats": build_chord_stats(dr_data, points),
        "clusterStats": build_cluster_stats(cluster),
    }
    save_json("insights.json", stats)


if __name__ == "__main__":
    main()
