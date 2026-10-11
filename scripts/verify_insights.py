import json
import math
import os
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "public", "data", "insights", "insights.json")
REQUIRED_TOP_LEVEL = {
    "groupStats",
    "mdsStats",
    "charDistinctiveness",
    "phonologyStats",
    "chordStats",
    "clusterStats",
}


def walk(value, path="root"):
    if isinstance(value, float) and not math.isfinite(value):
        raise AssertionError(f"non-finite number at {path}")
    if isinstance(value, dict):
        for key, child in value.items():
            walk(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk(child, f"{path}[{index}]")


def main() -> int:
    if not os.path.exists(PATH):
        print(f"missing {PATH}", file=sys.stderr)
        return 1
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    walk(data)
    missing = REQUIRED_TOP_LEVEL.difference(data)
    if missing:
        print(f"missing derived stats: {sorted(missing)}", file=sys.stderr)
        return 1
    if not data["groupStats"].get("groups"):
        print("groupStats.groups is empty", file=sys.stderr)
        return 1
    if not data["phonologyStats"].get("topCells"):
        print("phonologyStats.topCells is empty", file=sys.stderr)
        return 1
    if not data["charDistinctiveness"]:
        print("charDistinctiveness is empty", file=sys.stderr)
        return 1

    print(f"verified {len(REQUIRED_TOP_LEVEL)} derived-stat sections")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
