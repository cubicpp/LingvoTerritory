"""
fetch_mcpdict_tsv.py — Download ~50 representative dialect TSV files from MCPDict
Dynamically discovers TSV files via GitHub API and picks representative dialects.
Saves to data_raw/mcpdict/dialects/
"""
import urllib.request
import urllib.parse
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
OUT_DIR = BASE_DIR / "data_raw" / "mcpdict" / "dialects"
BASE_URL = "https://raw.githubusercontent.com/osfans/MCPDict/master/tools/tables/data"
API_URL = "https://api.github.com/repos/osfans/MCPDict/contents/tools/tables/data"


DESIRED_SHORT = [
    # 官话 - 东北/北京/冀鲁/胶辽/中原/兰银/西南/江淮
    "北京", "濟南", "西安", "太原", "武漢", "成都", "合肥", "揚州",
    "哈爾濱", "昆明", "南京", "瀋陽", "鄭州", "蘭州", "貴陽", "重慶",
    "青島", "大連", "煙台", "徐州", "西寧", "銀川", "烏魯木齊",
    "長春", "吉林", "錦州", "洛陽", "開封", "銀川", "呼和浩特",
    "天津", "石家莊", "桂林", "柳州", "安慶", "南通", "蘇州",
    # 吴语
    "上海", "蘇州", "溫州", "杭州", "寧波", "無錫", "常州",
    "紹興", "金華", "衢州", "麗水", "台州",
    # 粤语
    "廣州", "中國香港", "陽江", "南寧", "梧州", "中國澳門",
    "佛山", "東莞", "中山",
    # 闽语
    "廈門", "福州", "潮州", "建甌", "中國臺灣", "莆田",
    "泉州", "漳州", "汕頭",
    # 客家
    "客家", "梅縣", "贛州", "汀州", "惠州",
    # 湘语
    "長沙", "婁底", "邵陽", "衡陽",
    # 赣语
    "南昌", "九江", "景德鎮",
    # 晋语
    "平遙", "大同", "包頭",
    # 域外
    "朝鮮", "越南", "日語漢音", "日語吳音",
    # 其他
    "海口", "徽語",
]


def fetch_tsv_list() -> list[str]:
    """Fetch the list of .tsv filenames from the GitHub API."""
    req = urllib.request.Request(API_URL, headers={"User-Agent": "opencode"})
    try:
        with urllib.request.urlopen(req) as resp:
            items = json.loads(resp.read().decode("utf-8"))
        return [it["name"] for it in items if it["name"].endswith(".tsv")]
    except Exception as e:
        print(f"  Failed to fetch TSV list: {e}")
        return []


def url_encode(name: str) -> str:
    return urllib.parse.quote(name, safe="")


def find_best_match(desired: str, available: list[str]) -> str | None:
    """Find the best matching TSV filename for a desired dialect name."""
    # Priority 1: exact match "上海.tsv"
    exact = f"{desired}.tsv"
    if exact in available:
        return exact

    # Priority 2: prefix match (name starts with desired)
    for f in available:
        if f.startswith(desired) and len(f) < len(desired) + 15:
            return f

    # Priority 3: filename contains desired without trailing numbers/dates
    for f in available:
        base = f.replace(".tsv", "")
        if base == desired:
            return f
        # Check if stripped of suffix matches
        import re
        clean = re.sub(r"[\d\-_.].*$", "", f.replace(".tsv", ""))
        if clean == desired:
            return f

    # Priority 4: substring match ignoring punctuation/numbers
    for f in available:
        if desired in f and f.endswith(".tsv"):
            return f

    return None


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=== Fetching Dialect TSV Files ===\n")

    print("Discovering TSV files from GitHub API...")
    available = fetch_tsv_list()
    print(f"  Found {len(available)} TSV files\n")

    if not available:
        print("❌ Cannot fetch file list. Using static fallback.")
        available = []

    ok = 0
    fail = 0
    downloaded: set[str] = set()

    for desired in DESIRED_SHORT:
        filename = find_best_match(desired, available) if available else f"{desired}.tsv"

        if filename is None:
            # Try without API — just try the desired name
            filename = f"{desired}.tsv"

        if filename in downloaded:
            continue

        enc = url_encode(filename)
        url = f"{BASE_URL}/{enc}"
        dest = OUT_DIR / filename

        if dest.exists():
            size = dest.stat().st_size
            print(f"  [{filename}] Already exists ({size:,} bytes)")
            ok += 1
            downloaded.add(filename)
            continue

        print(f"  [{filename}] Downloading...")
        try:
            urllib.request.urlretrieve(url, dest)
            size = dest.stat().st_size
            print(f"  [{filename}] OK ({size:,} bytes)")
            ok += 1
            downloaded.add(filename)
        except Exception as e:
            print(f"  [{filename}] FAILED: {e}")
            fail += 1

    # If we have few successes, try additional known-good filenames
    if ok < 15 and available:
        print("\n  Trying additional filenames from API...")
        # Pick short, date-free filenames for coverage
        for f in sorted(available):
            if f in downloaded:
                continue
            if ok >= 50:
                break
            # Skip files with dates, underscores, or long names
            base = f.replace(".tsv", "")
            import re
            if re.search(r"[\d\-]{4,}", base):
                continue
            if base.startswith("_"):
                continue
            # Prefer short, clean names (likely major dialect points)
            if len(base) > 15:
                continue

            enc = url_encode(f)
            url = f"{BASE_URL}/{enc}"
            dest = OUT_DIR / f

            print(f"  [{f}] Downloading...")
            try:
                urllib.request.urlretrieve(url, dest)
                size = dest.stat().st_size
                print(f"  [{f}] OK ({size:,} bytes)")
                ok += 1
                downloaded.add(f)
            except Exception as e:
                print(f"  [{f}] FAILED: {e}")

    print(f"\n=== Summary: {ok} OK, {fail} FAILED ===")
    print(f"Files saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
