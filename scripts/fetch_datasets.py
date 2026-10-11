import os
import csv
import json
import re
import io
import math
import urllib.request
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data_raw"
PUBLIC_DATA_DIR = BASE_DIR / "public" / "data"
AUDIO_DIR = BASE_DIR / "public" / "audio"

URLS = {
    "languages": "https://raw.githubusercontent.com/lexibank/beidasinitic/master/cldf/languages.csv",
    "forms": "https://raw.githubusercontent.com/lexibank/beidasinitic/master/cldf/forms.csv",
    "glottolog": "https://glottolog.org/resource/languoid/id/sini1245.json",
    "chinageo": "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json",
    "phoible": "https://raw.githubusercontent.com/phoible/dev/master/data/phoible.csv",
}

def download(url, dest, label):
    dest = Path(dest)
    if dest.exists():
        print(f"  [{label}] Already exists: {dest.name}")
        return True
    print(f"  [{label}] Downloading...")
    try:
        urllib.request.urlretrieve(url, dest)
        size = dest.stat().st_size
        print(f"  [{label}] Done: {size:,} bytes -> {dest.name}")
        return True
    except Exception as e:
        print(f"  [{label}] FAILED: {e}")
        return False

def main():
    print("=== Fetching Chinese Dialect Datasets ===\n")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    results = {}
    for name, url in URLS.items():
        ext = ".json" if "json" in url or "glottolog" in url else ".csv"
        dest = RAW_DIR / f"{name}{ext}"
        results[name] = download(url, dest, name)

    print("\n=== Summary ===")
    for k, v in results.items():
        print(f"  {'✅' if v else '❌'} {k}")
    print("\nDone. Run preprocess.py next.")

if __name__ == "__main__":
    main()
