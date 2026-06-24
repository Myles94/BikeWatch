"""
BikeWatch data pipeline — stage 2: risk surface + light ML model + temporal +
held-out validation.

Inputs:  out/raw_larceny.json  (real APD "All Other Larceny" incidents, 2026 YTD)
Outputs (written to app/public/data/):
  heat-points.json  — every incident weighted by KDE risk, tagged with a zone idx
  incidents.json    — a clean sample of real theft markers
  zones.json        — per-neighborhood stats + model-predicted theft odds
  temporal.json     — per-zone + global weekday/weekend x 24h activity multipliers
  model.json        — trained model metadata, coefficients, and validation results

Model: Gaussian KDE risk surface; Poisson regression (numpy gradient ascent)
predicts each neighborhood's expected rate from density + temporal features,
calibrated to a 0..1 risk index. Temporal profiles let the heatmap shift by time
of day. A train/test split (older -> newer) reports the predictive accuracy index
(PAI): what share of held-out future thefts fall in the model's top-decile zones.

Bicycle theft has no NIBRS category, so "All Other Larceny" is a documented proxy.
Deps: numpy only. Run after fetch_crime.py:  python build_risk.py
"""

import json
import math
import os
from datetime import datetime, timezone

import numpy as np

HERE = os.path.dirname(__file__)
RAW_PATH = os.path.join(HERE, "out", "raw_larceny.json")
OUT_DIR = os.path.join(HERE, "..", "app", "public", "data")

KDE_BW = 0.004          # ~440 m bandwidth (degrees)
MARKER_SAMPLE = 60      # real theft dots rendered as markers
ZONE_MIN_COUNT = 5      # neighborhoods need >=5 incidents to get a profile/card
TEMP_ALPHA = 6.0        # Dirichlet smoothing toward the global temporal profile
VAL_TRAIN_FRAC = 0.7    # older 70% train, newer 30% test
GRID_STEP = 0.008       # ~0.8 km validation grid cells
TOP_DECILE = 0.10
BBOX = {"minLng": -84.95, "maxLng": -83.95, "minLat": 33.42, "maxLat": 34.12}
WINDOW_LABEL = "2026 YTD"


# ---------------------------------------------------------------- helpers
def iso(epoch_ms):
    if not epoch_ms:
        return None
    return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).isoformat()


def hour_of(epoch_ms):
    if not epoch_ms:
        return None
    return datetime.fromtimestamp(epoch_ms / 1000 - 4 * 3600, tz=timezone.utc).hour


def is_weekend(dow):
    d = (dow or "").lower()
    return d.startswith("sat") or d.startswith("sun")


def kde_scores(lats, lngs):
    la, ln = np.asarray(lats), np.asarray(lngs)
    n = len(la)
    out = np.zeros(n)
    inv = 1.0 / (2 * KDE_BW * KDE_BW)
    for i in range(n):
        d2 = (la - la[i]) ** 2 + (ln - ln[i]) ** 2
        out[i] = np.exp(-d2 * inv).sum()
    return out / out.max()


def kde_at(plat, plng, lats, lngs):
    la, ln = np.asarray(lats), np.asarray(lngs)
    d2 = (la - plat) ** 2 + (ln - plng) ** 2
    return float(np.exp(-d2 / (2 * KDE_BW * KDE_BW)).sum())


def poisson_fit(X, y, iters=4000, lr=0.05, l2=1e-3):
    beta = np.zeros(X.shape[1])
    for _ in range(iters):
        lam = np.exp(np.clip(X @ beta, -20, 20))
        beta = beta + lr * (X.T @ (y - lam) - l2 * beta) / len(y)
    return beta


def hour_multipliers(counts):
    """Turn a 24-length count vector into mean-1 multipliers (share * 24)."""
    total = counts.sum()
    if total <= 0:
        return np.ones(24)
    return (counts / total) * 24.0


def smoothed_multipliers(zone_counts, global_share):
    total = zone_counts.sum()
    share = (zone_counts + TEMP_ALPHA * global_share) / (total + TEMP_ALPHA)
    return share * 24.0


def _write(name, obj, indent=None):
    with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=indent)


# ---------------------------------------------------------------- main
def main():
    with open(RAW_PATH, encoding="utf-8") as fp:
        rows = json.load(fp)
    rows = [r for r in rows if r.get("lat") and r.get("lng")]
    for r in rows:
        r["hr"] = hour_of(r.get("t"))
        r["we"] = is_weekend(r.get("dow"))
    lats = [r["lat"] for r in rows]
    lngs = [r["lng"] for r in rows]
    print(f"Loaded {len(rows)} real incidents")

    # ---- KDE risk surface (per-incident weight) ----
    risk = kde_scores(lats, lngs)
    contrast = np.power(risk, 0.65)

    # ---- Neighborhood aggregation + temporal features ----
    zmap = {}
    for r in rows:
        hood = r.get("hood") or "Unknown"
        z = zmap.setdefault(
            hood,
            {"label": hood, "lat": 0.0, "lng": 0.0, "count": 0, "night": 0,
             "weekend": 0, "wd_hours": np.zeros(24), "we_hours": np.zeros(24)},
        )
        z["lat"] += r["lat"]
        z["lng"] += r["lng"]
        z["count"] += 1
        h = r["hr"]
        if h is not None:
            (z["we_hours"] if r["we"] else z["wd_hours"])[h] += 1
            if h >= 18 or h < 6:
                z["night"] += 1
        if r["we"]:
            z["weekend"] += 1

    zones = []
    for z in zmap.values():
        if z["count"] < ZONE_MIN_COUNT or z["label"] == "Unknown":
            continue
        c = z["count"]
        clat, clng = z["lat"] / c, z["lng"] / c
        zones.append(
            {
                "label": z["label"],
                "lat": round(clat, 6),
                "lng": round(clng, 6),
                "count": c,
                "nightShare": z["night"] / c,
                "weekendShare": z["weekend"] / c,
                "density": kde_at(clat, clng, lats, lngs),
                "_wd": z["wd_hours"],
                "_we": z["we_hours"],
            }
        )
    print(f"{len(zones)} neighborhoods with >= {ZONE_MIN_COUNT} incidents")

    # ---- Temporal profiles (global + per-zone, mean-1 multipliers) ----
    gw = np.zeros(24)
    ge = np.zeros(24)
    for r in rows:
        h = r["hr"]
        if h is not None:
            (ge if r["we"] else gw)[h] += 1
    gw_share = gw / gw.sum() if gw.sum() else np.ones(24) / 24
    ge_share = ge / ge.sum() if ge.sum() else np.ones(24) / 24

    zone_names = [z["label"] for z in zones]
    name_to_idx = {n: i for i, n in enumerate(zone_names)}
    zone_profiles = {
        z["label"]: {
            "wd": [round(float(x), 3) for x in smoothed_multipliers(z["_wd"], gw_share)],
            "we": [round(float(x), 3) for x in smoothed_multipliers(z["_we"], ge_share)],
        }
        for z in zones
    }

    temporal = {
        "hours": 24,
        "dayTypes": ["weekday", "weekend"],
        "global": {
            "wd": [round(float(x), 3) for x in hour_multipliers(gw)],
            "we": [round(float(x), 3) for x in hour_multipliers(ge)],
        },
        "zoneNames": zone_names,
        "zones": zone_profiles,
    }

    # ---- Heat points (with zone index for temporal weighting) ----
    heat_points = [
        {
            "lat": rows[i]["lat"],
            "lng": rows[i]["lng"],
            "w": round(float(contrast[i]), 4),
            "z": name_to_idx.get(rows[i].get("hood"), -1),
        }
        for i in range(len(rows))
    ]

    # ---- Poisson regression: expected rate per neighborhood ----
    feat_names = ["intercept", "log_density", "night_share", "weekend_share"]
    raw_feats = np.array(
        [[1.0, math.log(z["density"] + 1e-6), z["nightShare"], z["weekendShare"]] for z in zones]
    )
    mu = raw_feats[:, 1:].mean(axis=0)
    sd = raw_feats[:, 1:].std(axis=0) + 1e-9
    X = raw_feats.copy()
    X[:, 1:] = (raw_feats[:, 1:] - mu) / sd
    y = np.array([z["count"] for z in zones], dtype=float)
    beta = poisson_fit(X, y)
    lam = np.exp(np.clip(X @ beta, -20, 20))

    logs = np.log(lam + 1e-6)
    zlog = (logs - logs.mean()) / (logs.std() + 1e-9)
    odds = 1.0 / (1.0 + np.exp(-1.15 * zlog))
    odds = 0.12 + 0.83 * (odds - odds.min()) / (odds.max() - odds.min() + 1e-9)

    def tier(p):
        return "High" if p >= 0.66 else "Medium" if p >= 0.4 else "Low"

    max_density = max(z["density"] for z in zones)
    for i, z in enumerate(zones):
        p = float(odds[i])
        z["stolenProbability"] = round(p, 3)
        z["theftCount"] = z["count"]
        z["avg"] = round(float(min(0.98, 0.3 + 0.6 * z["density"] / max_density)), 3)
        z["tier"] = tier(p)
        z["predictedRate"] = round(float(lam[i]), 2)
        for k in ("density", "_wd", "_we"):
            del z[k]
    zones.sort(key=lambda z: z["stolenProbability"], reverse=True)
    for rank, z in enumerate(zones):
        z["id"] = f"z-{rank}"

    # ---- Held-out validation: top-decile capture / PAI ----
    validation = build_validation(rows)
    if validation:
        print(
            f"Validation: top-5% hotspots captured "
            f"{validation['topHotspotCapture']*100:.0f}% of held-out thefts "
            f"(PAI {validation['pai']:.1f}x), curve {validation['captureCurve']}, "
            f"train {validation['trainN']} / test {validation['testN']}"
        )

    # ---- Real theft markers (recent sample) ----
    order = sorted(range(len(rows)), key=lambda i: rows[i].get("t") or 0, reverse=True)
    incidents = []
    for i in order[:MARKER_SAMPLE]:
        r = rows[i]
        hood = r.get("hood") or "Atlanta"
        incidents.append(
            {
                "id": f"apd-{i}", "type": "theft",
                "title": f"Larceny reported — {hood}",
                "description": "APD-reported larceny (NIBRS 'All Other Larceny'), "
                "used as a bike-theft risk proxy.",
                "lat": r["lat"], "lng": r["lng"], "timestamp": iso(r.get("t")),
                "riskWeight": round(float(contrast[i]), 3), "neighborhood": hood,
                "source": "apd",
            }
        )

    os.makedirs(OUT_DIR, exist_ok=True)
    _write("heat-points.json", heat_points)
    _write("incidents.json", incidents, indent=0)
    _write("zones.json", zones, indent=0)
    _write("temporal.json", temporal, indent=0)
    _write(
        "model.json",
        {
            "method": "Gaussian KDE risk surface + Poisson regression (gradient ascent)",
            "proxy": "NIBRS 'All Other Larceny' (bicycle theft has no NIBRS category)",
            "source": "Atlanta PD open data — OpenDataWebsite_Crime_view",
            "window": WINDOW_LABEL,
            "nIncidents": len(rows),
            "nZones": len(zones),
            "features": feat_names,
            "coefficients": {feat_names[k]: round(float(beta[k]), 4) for k in range(len(beta))},
            "kdeBandwidthDeg": KDE_BW,
            "validation": validation,
        },
        indent=2,
    )

    print("Top zones:")
    for z in zones[:6]:
        print(f"  {int(z['stolenProbability']*100):>3}%  {z['label']}  (n={z['count']})")
    print(f"\nWrote heat-points({len(heat_points)}), incidents({len(incidents)}), "
          f"zones({len(zones)}), temporal({len(zone_names)} zones), model -> {OUT_DIR}")


def build_validation(rows):
    dated = sorted([r for r in rows if r.get("t")], key=lambda r: r["t"])
    if len(dated) < 50:
        return None
    cut = int(len(dated) * VAL_TRAIN_FRAC)
    train, test = dated[:cut], dated[cut:]
    tlat = np.array([r["lat"] for r in train])
    tlng = np.array([r["lng"] for r in train])

    # Study area = the actual incident footprint (1st–99th pct), NOT the full
    # bbox — otherwise "top decile" trivially covers the whole urban core and
    # the metric is meaningless. This keeps the baseline honest.
    alat = np.array([r["lat"] for r in dated])
    alng = np.array([r["lng"] for r in dated])
    lo_lat, hi_lat = np.percentile(alat, [1, 99])
    lo_lng, hi_lng = np.percentile(alng, [1, 99])

    inv = 1.0 / (2 * KDE_BW * KDE_BW)
    lng_edges = np.arange(lo_lng, hi_lng, GRID_STEP)
    lat_edges = np.arange(lo_lat, hi_lat, GRID_STEP)
    cell_risk = {}
    for i, clng in enumerate(lng_edges):
        d2lng = (tlng - (clng + GRID_STEP / 2)) ** 2
        for j, clat in enumerate(lat_edges):
            cy = clat + GRID_STEP / 2
            cell_risk[(i, j)] = float(np.exp(-(d2lng + (tlat - cy) ** 2) * inv).sum())

    ranked = [k for k, _ in sorted(cell_risk.items(), key=lambda kv: kv[1], reverse=True)]
    n_cells = len(ranked)

    def cell_of(r):
        return (int((r["lng"] - lo_lng) / GRID_STEP), int((r["lat"] - lo_lat) / GRID_STEP))

    test_cells = [cell_of(r) for r in test]

    def capture_at(coverage):
        n_top = max(1, int(n_cells * coverage))
        top = set(ranked[:n_top])
        hits = sum(1 for c in test_cells if c in top)
        return round(hits / len(test), 3)

    headline = capture_at(0.05)
    return {
        "method": "older 70% train / newer 30% test; KDE risk grid over incident "
        "footprint; hotspot capture of held-out thefts",
        "trainN": len(train),
        "testN": len(test),
        "trainEnd": iso(train[-1]["t"])[:10],
        "hotspotCoverage": 0.05,
        "topHotspotCapture": headline,
        "pai": round(headline / 0.05, 2),
        "captureCurve": {
            "2%": capture_at(0.02),
            "5%": capture_at(0.05),
            "10%": capture_at(0.10),
            "20%": capture_at(0.20),
        },
        "gridCells": n_cells,
    }


if __name__ == "__main__":
    main()
