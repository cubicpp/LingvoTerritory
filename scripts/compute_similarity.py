"""
Rebuild ling_mds: keep phonological positions for xx_bundles points (406),
add geo positions for remaining points, fix groups to match dialects.json broad.
"""
import json, math, numpy as np
from pathlib import Path
from collections import defaultdict

BASE = Path(__file__).resolve().parent.parent
PUBLIC = BASE / "public" / "data"
BUNDLE_DIR = PUBLIC / "xx_bundles"

# ─── Step 1: Compute phonological similarity for xx_bundles points ───
print("Loading xx_bundles...")
bundles = sorted(BUNDLE_DIR.glob("*.json"))

dialect_chars = defaultdict(set)
xx_dialects = set()
all_chars = set()
for bf in bundles:
    with open(bf, encoding="utf-8") as f:
        bundle = json.load(f)
    for char_code, entries in bundle.items():
        all_chars.add(char_code)
        for pt_name in entries:
            xx_dialects.add(pt_name)
            dialect_chars[pt_name].add(char_code)

xx_dialects_list = sorted(xx_dialects)
n_xx = len(xx_dialects_list)
print(f"  {n_xx} xx_bundles dialect points, {len(all_chars)} characters")

# Use all characters
common_chars = sorted(all_chars)
n_common = len(common_chars)
print(f"  Using all {n_common} characters")

dialect_idx = {d: i for i, d in enumerate(xx_dialects_list)}
feat_matrix = np.full((n_common, n_xx), "", dtype=object)
char_pos = {c: i for i, c in enumerate(common_chars)}

for bf in bundles:
    with open(bf, encoding="utf-8") as f:
        bundle = json.load(f)
    for char_code, entries in bundle.items():
        if char_code not in char_pos:
            continue
        ci = char_pos[char_code]
        for pt_name, vals in entries.items():
            if pt_name not in dialect_idx:
                continue
            di = dialect_idx[pt_name]
            if vals and len(vals) > 0:
                v = vals[0]
                feat_matrix[ci, di] = f"{v.get('initial','')}|{v.get('final','')}|{v.get('tone_category','')}"

# Feature IDs
all_feats = set()
for i in range(n_common):
    for j in range(n_xx):
        v = feat_matrix[i, j]
        if v:
            all_feats.add(v)
feat_ids = {v: i for i, v in enumerate(sorted(all_feats))}
n_feats = len(feat_ids)
print(f"  {n_feats} unique features")

# Feature distribution per dialect
feat_counts = np.zeros((n_xx, n_feats), dtype=np.float64)
for j in range(n_xx):
    for i in range(n_common):
        fid = feat_matrix[i, j]
        if fid:
            idx = feat_ids.get(fid, -1)
            if idx >= 0:
                feat_counts[j, idx] += 1

dialect_totals = feat_counts.sum(axis=1)
dialect_totals[dialect_totals == 0] = 1
feat_probs = feat_counts / dialect_totals[:, None]

# Pairwise overlap similarity (vectorized, blockwise)
print("Computing pairwise similarity...")
sim_matrix = np.zeros((n_xx, n_xx))
block = 50
for bi in range(0, n_xx, block):
    bi_end = min(bi + block, n_xx)
    for bj in range(bi, n_xx, block):
        bj_end = min(bj + block, n_xx)
        probs_i = feat_probs[bi:bi_end]
        probs_j = feat_probs[bj:bj_end]
        overlap = np.minimum(probs_i[:, None, :], probs_j[None, :, :]).sum(axis=2)
        count_i = dialect_totals[bi:bi_end]
        count_j = dialect_totals[bj:bj_end]
        scale = 1.0 / (1.0 + np.abs(count_i[:, None] - count_j[None, :]) / (count_i[:, None] + count_j[None, :] + 1))
        sim_block = overlap * scale
        sim_matrix[bi:bi_end, bj:bj_end] = sim_block
        if bi != bj:
            sim_matrix[bj:bj_end, bi:bi_end] = sim_block.T
    if bi % 100 == 0:
        print(f"  block {bi}/{n_xx}")

print(f"  Similarity range: [{sim_matrix.min():.4f}, {sim_matrix.max():.4f}]")

# Distance + MDS for xx points
print("MDS for xx points...")
dist_matrix = np.sqrt(np.maximum(-2 * sim_matrix + np.diagonal(sim_matrix)[:, None] + np.diagonal(sim_matrix)[None, :], 0))
n = n_xx
D2 = dist_matrix ** 2
B = -0.5 * (D2 - D2.mean(axis=1, keepdims=True) - D2.mean(axis=0, keepdims=True) + D2.mean())
eigvals, eigvecs = np.linalg.eigh(B)
idx = np.argsort(eigvals)[::-1]
eigvecs = eigvecs[:, idx]
eigvals = eigvals[idx]

e1, e2 = max(eigvals[0], 0), max(eigvals[1], 0)
xx_coords = [[round(float(eigvecs[i, 0] * math.sqrt(e1)), 4), round(float(eigvecs[i, 1] * math.sqrt(e2)), 4)] for i in range(n)]

# ─── Step 2: Merge with geo MDS ───
geo_mds = json.load(open(PUBLIC / "mds_coords.json", encoding="utf-8"))
dialects = json.load(open(PUBLIC / "dialects.json", encoding="utf-8"))

# Build ID/name → broad lookup
broad_map = {}
for p in dialects["points"]:
    if p.get("broad") and p["id"]:
        broad_map[p["id"]] = p["broad"]
    if p.get("broad") and p.get("name") and p["name"] != p["id"]:
        broad_map[p["name"]] = p["broad"]

# Map xx point names → xx indices
xx_coord_map = {name: xx_coords[i] for i, name in enumerate(xx_dialects_list)}

# Build valid ID set from dialects.json for exact matching
dial_valid_ids = set()
for p in dialects["points"]:
    if p["id"]: dial_valid_ids.add(p["id"])
    if p.get("name"): dial_valid_ids.add(p["name"])

# Build merged output: xx points first (phonological coords), then geo points
all_ids, all_coords, all_groups, all_names = [], [], [], []

# Add xx points with phonological coords
for name in xx_dialects_list:
    all_ids.append(name)
    all_coords.append(xx_coord_map[name])
    grp = broad_map.get(name, "")
    if not grp:
        for did, db in broad_map.items():
            if name in did or did in name:
                grp = db
                break
    all_groups.append(grp or "未分类")
    all_names.append(name)

# Manual classify any remaining 未分类
manual = {
    "保安":"粤语","富川(七都話)":"平话土话","富川(八都話)":"平话土话",
    "星子":"赣语","江永城關(白水村)":"湘语","湖南(道縣)":"湘语",
    "西岸":"粤语","豐陽":"粤语","賀州(九都話)":"平话土话",
    "連州":"粤语","鍾山(公安)":"平话土话",
}
for i in range(len(all_ids)):
    if all_groups[i] == "未分类" and all_ids[i] in manual:
        all_groups[i] = manual[all_ids[i]]

result = {"coords": all_coords, "ids": all_ids, "groups": all_groups, "names": all_names}
with open(PUBLIC / "ling_mds_coords.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)

# Verify counts
print(f"\nPhonological MDS: {len(all_ids)} points")
for g in sorted(set(all_groups)):
    mds_cnt = sum(1 for x in all_groups if x == g)
    dial_cnt = sum(1 for p in dialects["points"] if p.get("broad","") == g)
    if mds_cnt != dial_cnt:
        print(f"  MISMATCH {g}: MDS={mds_cnt} Dialects={dial_cnt}")
    else:
        print(f"  OK {g}: {mds_cnt}")

# ─── Hierarchical clustering + sorted matrix ───
try:
    import scipy.cluster.hierarchy as sch
    from scipy.spatial.distance import squareform

    n = len(xx_dialects_list)

    # Convert similarity to distance
    d2 = np.diagonal(sim_matrix).copy()
    dist_sq = -2 * sim_matrix + d2[:, None] + d2[None, :]
    dist_sq = np.maximum(dist_sq, 0)
    dist_matrix_full = np.sqrt(dist_sq)
    dist_matrix_full = (dist_matrix_full + dist_matrix_full.T) / 2

    dist_condensed = squareform(dist_matrix_full)
    Z = sch.linkage(dist_condensed, method="ward")

    # Convert linkage to nested tree JSON
    node_index = n
    def build_tree(node_idx):
        if node_idx < n:
            return {
                "name": xx_dialects_list[node_idx],
                "group": all_groups[node_idx] if node_idx < len(all_groups) else "未分类",
            }
        left = int(Z[node_idx - n, 0])
        right = int(Z[node_idx - n, 1])
        dist = float(Z[node_idx - n, 2])
        return {
            "name": "",
            "distance": round(dist, 4),
            "children": [build_tree(left), build_tree(right)],
        }

    root = build_tree(len(Z) - 1 + n)
    with open(PUBLIC / "ling_cluster.json", "w", encoding="utf-8") as f:
        json.dump(root, f, ensure_ascii=False)
    print("  ling_cluster.json: written (ward method)")

    # Sort matrix by dialect group
    with open(PUBLIC / "xx_overlap.json", encoding="utf-8") as f:
        xx_overlap_data = json.load(f)
    xx_groups_for_sort = [xx_overlap_data.get(name, {}).get("group", "") or "未分类" for name in xx_dialects_list]
    sort_idx = sorted(range(n), key=lambda i: (xx_groups_for_sort[i], xx_dialects_list[i]))
    sorted_names = [xx_dialects_list[i] for i in sort_idx]
    sorted_groups = [xx_groups_for_sort[i] for i in sort_idx]
    sorted_matrix = [[round(float(sim_matrix[i, j]), 4) for j in sort_idx] for i in sort_idx]

    sim_out = {"dialects": sorted_names, "groups": sorted_groups, "matrix": sorted_matrix}
    with open(PUBLIC / "ling_sim_matrix.json", "w", encoding="utf-8") as f:
        json.dump(sim_out, f, ensure_ascii=False)
    print(f"  ling_sim_matrix.json: {len(sorted_names)}x{len(sorted_names)}, grouped by dialect")

    # Cluster labels for map coloring
    n_clusters = min(15, n)
    cluster_labels = sch.fcluster(Z, n_clusters, criterion="maxclust")
    cluster_data = {"labels": [int(cluster_labels[i]) for i in sort_idx], "dialects": sorted_names, "n_clusters": n_clusters}
    with open(PUBLIC / "ling_cluster_labels.json", "w", encoding="utf-8") as f:
        json.dump(cluster_data, f, ensure_ascii=False)
    print(f"  ling_cluster_labels.json: {n_clusters} clusters")
except ImportError:
    print("  scipy not installed, skip clustering")

# Copy groups to geo MDS for consistency
geo_mds["groups"] = [broad_map.get(gid, "未分类") for gid in geo_mds["ids"]]
with open(PUBLIC / "mds_coords.json", "w", encoding="utf-8") as f:
    json.dump(geo_mds, f, ensure_ascii=False)

print("Done.")
