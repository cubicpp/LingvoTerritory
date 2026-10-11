"""
fetch_mcpdict.py — 从 MCPDict 仓库下载原始数据文件

下载资源：
  info.geojson              — 2707 个方言点 GIS 坐标 + 分类元数据
  mcpdict.db                — 聚合 SQLite 数据库（汉字读音）
  廣韻.tsv                  — 中古音韵数据（2.5万行 × 27列）
  BaxterSagartOC2015-10-13.tsv — 上古音白一平-沙加尔构拟
  Unihan_Readings.txt       — Unicode 汉字读音数据
"""

import urllib.request
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
RAW_MCPDICT_DIR = BASE_DIR / "data_raw" / "mcpdict"
MCPDICT_LOCAL = BASE_DIR.parent / "MCPDict"  # Local MCPDict repo

MCPDICT_RAW = "https://raw.githubusercontent.com/osfans/MCPDict/master"

URLS = {
    "info.geojson": f"{MCPDICT_RAW}/tools/info.geojson",
    "mcpdict.db": f"{MCPDICT_RAW}/tools/tables/data/mcpdict.db",
    "廣韻.tsv": f"{MCPDICT_RAW}/tools/tables/data/%E5%BB%A3%E9%9F%BB.tsv",
    "BaxterSagartOC.tsv": f"{MCPDICT_RAW}/tools/tables/data/BaxterSagartOC2015-10-13.tsv",
    "Unihan_Readings.txt": f"{MCPDICT_RAW}/tools/tables/data/Unihan_Readings.txt",
    # Phase A: additional resources for character/dictionary data
    "異體字.tsv": f"{MCPDICT_RAW}/tools/tables/data/%E7%95%B0%E9%AB%94%E5%AD%97.tsv",
    "說文.tsv": f"{MCPDICT_RAW}/tools/tables/data/%E8%AA%AA%E6%96%87.tsv",
    "集韻.md": f"{MCPDICT_RAW}/tools/tables/data/%E9%9B%86%E9%9F%BB.md",
    "kangxizidian-v3f.txt": f"{MCPDICT_RAW}/tools/tables/data/kangxizidian-v3f.txt",
    "部件檢索.htm": f"{MCPDICT_RAW}/tools/tables/data/%E9%83%A8%E4%BB%B6%E6%AA%A2%E7%B4%A2.htm",
    "IDS.txt": f"{MCPDICT_RAW}/tools/tables/data/IDS.txt",
    # Phase B: additional dictionaries & survey table
    "漢大.tsv": f"{MCPDICT_RAW}/tools/tables/data/%E6%BC%A2%E5%A4%A7.tsv",
    "方言調查字表.tsv": f"{MCPDICT_RAW}/tools/tables/data/%E6%96%B9%E8%A8%80%E8%AA%BF%E6%9F%A5%E5%AD%97%E8%A1%A8.tsv",
}


def _copy_from_local(name: str, dest: Path) -> bool:
    """Try copying a file from the local MCPDict repo."""
    mappings = {
        "漢大.tsv": MCPDICT_LOCAL / "tools" / "tables" / "data" / "漢大.tsv",
        "方言調查字表.tsv": MCPDICT_LOCAL / "tools" / "tables" / "data" / "方言調查字表.tsv",
        "匯纂.tsv": MCPDICT_LOCAL / "tools" / "tables" / "output" / "匯纂.tsv",
    }
    local_src = mappings.get(name)
    if local_src and local_src.exists():
        shutil.copy2(local_src, dest)
        return True
    return False


def download(url, dest, label):
    dest = Path(dest)
    if dest.exists():
        size = dest.stat().st_size
        print(f"  [{label}] Already exists: {size:,} bytes")
        return True

    # Try local MCPDict copy first
    if _copy_from_local(label, dest):
        size = dest.stat().st_size
        print(f"  [{label}] Copied from local MCPDict: {size:,} bytes")
        return True

    print(f"  [{label}] Downloading from {url[:80]}...")
    try:
        urllib.request.urlretrieve(url, dest)
        size = dest.stat().st_size
        print(f"  [{label}] Done: {size:,} bytes")
        return True
    except Exception as e:
        print(f"  [{label}] FAILED: {e}")
        return False


def main():
    print("=== Fetching MCPDict Datasets ===\n")
    RAW_MCPDICT_DIR.mkdir(parents=True, exist_ok=True)

    results = {}
    for name, url in URLS.items():
        dest = RAW_MCPDICT_DIR / name
        results[name] = download(url, dest, name)

    # Also copy 匯纂.tsv from local MCPDict output
    hz_name = "匯纂.tsv"
    hz_dest = RAW_MCPDICT_DIR / hz_name
    if not hz_dest.exists():
        if _copy_from_local(hz_name, hz_dest):
            print(f"  [{hz_name}] Copied from local MCPDict: {hz_dest.stat().st_size:,} bytes")
            results[hz_name] = True
        else:
            print(f"  [{hz_name}] Not found — skipping (optional)")
            results[hz_name] = False
    else:
        results[hz_name] = True

    print("\n=== Summary ===")
    for k, v in results.items():
        print(f"  {'✅' if v else '❌'} {k}")

    # Copy mcpdict.db to public/ for sql.js
    src_db = RAW_MCPDICT_DIR / "mcpdict.db"
    public_dir = BASE_DIR / "public"
    public_dir.mkdir(parents=True, exist_ok=True)
    dst_db = public_dir / "mcpdict.db"
    if src_db.exists():
        dst_db.write_bytes(src_db.read_bytes())
        print(f"\n  ✅ mcpdict.db copied to public/ ({dst_db.stat().st_size:,} bytes)")

    print("\nDone. Run preprocess_v3.py next.")


if __name__ == "__main__":
    main()
