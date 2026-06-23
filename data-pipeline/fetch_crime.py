"""
BikeWatch data pipeline — stage 1: fetch real Atlanta theft data.

Source: Atlanta Police Department open data (ArcGIS Hub), public crime view
  OpenDataWebsite_Crime_view / FeatureServer / 0  (NIBRS dataset, ~300k records)

In NIBRS, bicycle theft is coded as "All Other Larceny" (there is no bike- or
scooter-specific category), so we use that offense as a defensible proxy for
bike-theft risk. We pull all such incidents with valid coordinates for the
current year (2026 YTD) within the greater-Atlanta bounding box and write a
compact raw JSON.

No third-party deps — stdlib only (urllib). Run: python fetch_crime.py
"""

import json
import os
import time
import urllib.parse
import urllib.request

BASE = (
    "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/"
    "OpenDataWebsite_Crime_view/FeatureServer/0/query"
)

# Proxy offense for bicycle/personal-property theft (NIBRS bucket for bikes).
PROXY_OFFENSE = "All Other Larceny"

# Greater Atlanta bounding box (matches the app's maxBounds).
BBOX = {"minLng": -84.95, "maxLng": -83.95, "minLat": 33.42, "maxLat": 34.12}
# Current year to date — keeps the map current and uncluttered.
SINCE = "2026-01-01"

OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
RAW_PATH = os.path.join(OUT_DIR, "raw_larceny.json")

PAGE = 2000  # server maxRecordCount


def build_where() -> str:
    return (
        f"NIBRS_Offense='{PROXY_OFFENSE}' "
        f"AND Latitude>={BBOX['minLat']} AND Latitude<={BBOX['maxLat']} "
        f"AND Longitude>={BBOX['minLng']} AND Longitude<={BBOX['maxLng']} "
        f"AND OccurredFromDate>=DATE '{SINCE}'"
    )


def fetch_page(offset: int) -> dict:
    params = {
        "where": build_where(),
        "outFields": "OccurredFromDate,NIBRS_Offense,Latitude,Longitude,"
        "NhoodName,NPU,BEAT,Day_of_the_week",
        "orderByFields": "OccurredFromDate DESC",
        "resultOffset": offset,
        "resultRecordCount": PAGE,
        "returnGeometry": "false",
        "f": "json",
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "BikeWatch/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    offset = 0
    while True:
        data = fetch_page(offset)
        feats = data.get("features", [])
        if not feats:
            break
        for f in feats:
            a = f.get("attributes", {})
            lat, lng = a.get("Latitude"), a.get("Longitude")
            if lat is None or lng is None:
                continue
            rows.append(
                {
                    "lat": round(float(lat), 6),
                    "lng": round(float(lng), 6),
                    "t": a.get("OccurredFromDate"),  # epoch ms
                    "hood": (a.get("NhoodName") or "").strip() or None,
                    "npu": (a.get("NPU") or "").strip() or None,
                    "beat": (a.get("BEAT") or "").strip() or None,
                    "dow": (a.get("Day_of_the_week") or "").strip() or None,
                }
            )
        print(f"  fetched {len(feats):>4} (offset {offset}) -> total {len(rows)}")
        if len(feats) < PAGE:
            break
        offset += PAGE
        time.sleep(0.2)

    with open(RAW_PATH, "w", encoding="utf-8") as fp:
        json.dump(rows, fp)
    print(f"\nWrote {len(rows)} incidents -> {RAW_PATH}")


if __name__ == "__main__":
    main()
