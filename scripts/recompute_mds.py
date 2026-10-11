"""
recompute_mds.py — 对合并后的 2885 点重新计算 MDS 坐标
"""
import json, math
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
PUBLIC = BASE / "public" / "data"

with open(PUBLIC / "dialects.json", encoding="utf-8") as f:
    dialects = json.load(f)
points = dialects["points"]

# Haversine distance
def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

n = len(points)
ids = [p["id"] for p in points]
names = [p.get("title") or p.get("name") or p["id"] for p in points]
groups = [p.get("broad") or p.get("group") or "" for p in points]

# Distance matrix
print(f"Computing {n}x{n} Haversine distance matrix...")
D = [[0.0]*n for _ in range(n)]
for i in range(n):
    for j in range(i+1, n):
        pi, pj = points[i], points[j]
        lat1, lng1 = pi.get("lat"), pi.get("lng")
        lat2, lng2 = pj.get("lat"), pj.get("lng")
        if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
            d = 10000  # large distance for missing coords
        else:
            d = haversine(lat1, lng1, lat2, lng2)
        D[i][j] = d
        D[j][i] = d

# Classical MDS
print("Running MDS...")
D2 = [[D[i][j]**2 for j in range(n)] for i in range(n)]
row_means = [sum(row)/n for row in D2]
grand_mean = sum(row_means)/n

B = [[0.0]*n for _ in range(n)]
for i in range(n):
    for j in range(n):
        B[i][j] = -0.5 * (D2[i][j] - row_means[i] - row_means[j] + grand_mean)

def mat_vec_mul(M, v):
    return [sum(M[i][j]*v[j] for j in range(n)) for i in range(n)]

def normalize(v):
    norm = math.sqrt(sum(x*x for x in v))
    return [x/norm for x in v]

def power_iteration(M, iters=80):
    v = [1.0/math.sqrt(n)] * n
    for _ in range(iters):
        v = normalize(mat_vec_mul(M, v))
    mv = mat_vec_mul(M, v)
    eigenval = sum(v[i]*mv[i] for i in range(n))
    return eigenval, v

eigval1, eigvec1 = power_iteration(B)
B2 = [[B[i][j] - eigval1*eigvec1[i]*eigvec1[j] for j in range(n)] for i in range(n)]
eigval2, eigvec2 = power_iteration(B2)

coords = []
for i in range(n):
    coords.append([
        round(eigvec1[i] * math.sqrt(max(eigval1, 0)), 4),
        round(eigvec2[i] * math.sqrt(max(eigval2, 0)), 4),
    ])

total_trace = sum(B[i][i] for i in range(n))
explained = (eigval1 + eigval2) / total_trace * 100 if total_trace > 0 else 0
print(f"MDS done: {explained:.1f}% variance explained")

result = {
    "coords": coords,
    "ids": ids,
    "groups": groups,
    "names": names,
    "varianceExplained": round(explained, 2),
}

with open(PUBLIC / "mds_coords.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)

print(f"Written mds_coords.json: {len(ids)} points")
