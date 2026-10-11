import json

# 1. Verify GeoJSON coordinates
with open("public/data/china.json", "r", encoding="utf-8") as f:
    geo = json.load(f)

print("=== GeoJSON Check ===")
print(f"Type: {geo.get('type')}")
print(f"Features: {len(geo.get('features', []))}")
# Check first feature geometry
feat = geo["features"][0]
geom = feat.get("geometry", {})
print(f"Geometry type: {geom.get('type')}")
print(f"Name: {feat.get('properties', {}).get('name', '?')}")

# Check coordinate range
all_coords = []


def extract_coords(obj):
    if isinstance(obj, (int, float)):
        return obj
    if isinstance(obj, list):
        if len(obj) >= 2 and isinstance(obj[0], (int, float)) and isinstance(obj[1], (int, float)):
            all_coords.append(obj)
            return obj
        return [extract_coords(c) for c in obj]
    return obj


for feat in geo["features"]:
    extract_coords(feat.get("geometry", {}))

if all_coords:
    lngs = [c[0] for c in all_coords]
    lats = [c[1] for c in all_coords]
    print(
        f"Coord range: lng=[{min(lngs):.1f}, {max(lngs):.1f}], lat=[{min(lats):.1f}, {max(lats):.1f}]"
    )
    print(
        f"Expected China: lng ~[73, 135], lat ~[18, 54]"
    )

# 2. Verify tree structure
print("\n=== Tree Check ===")
with open("public/data/tree.json", "r", encoding="utf-8") as f:
    tree = json.load(f)


def count_nodes(node):
    c = 1
    for child in node.get("children", []):
        c += count_nodes(child)
    return c


def max_depth(node):
    if "children" not in node or not node["children"]:
        return 1
    return 1 + max(max_depth(c) for c in node["children"])


print(f"Root: {tree['name']}")
print(f"Total nodes: {count_nodes(tree)}")
print(f"Max depth: {max_depth(tree)}")

# 3. Verify dialects
print("\n=== Dialects Check ===")
with open("public/data/dialects.json", "r", encoding="utf-8") as f:
    dialects = json.load(f)

print(f"Total dialects: {len(dialects)}")
groups = set(d["group"] for d in dialects)
print(f"Groups: {sorted(groups)}")

for d in dialects:
    lat, lng = d["lat"], d["lng"]
    if lat < 15 or lat > 55 or lng < 70 or lng > 140:
        print(f"WARNING: {d['name']} coords out of range: ({lat}, {lng})")

# 4. Verify distance matrix
print("\n=== Distance Matrix Check ===")
with open("public/data/distance.json", "r", encoding="utf-8") as f:
    dist = json.load(f)

print(f"IDs: {len(dist['ids'])}")
n = len(dist["ids"])
print(f"Matrix: {len(dist['matrix'])}x{len(dist['matrix'][0])}")
assert n == len(dist["matrix"]), "Row count mismatch"
assert n == len(dist["matrix"][0]), "Col count mismatch"

print("\n=== All Checks Passed ===")
