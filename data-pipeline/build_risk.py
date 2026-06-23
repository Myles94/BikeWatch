"""
BikeWatch data pipeline — stage 2: build the risk surface + light ML model.

Inputs:  out/raw_larceny.json  (real APD "All Other Larceny" incidents, 2026 YTD)
Outputs (written to app/public/data/):
  heat-points.json  — every incident weighted by a KDE risk score (heatmap)
  incidents.json    — a clean sample of real theft markers + curated demo reports
  zones.json        — per-neighborhood stats + model-predicted theft odds
  model.json        — trained model metadata (coefficients, method) for honesty

Model: a Gaussian KDE produces a continuous risk surface; a Poisson regression
(fit by gradient ascent in numpy) predicts each neighborhood's expected incident
rate from spatial density + temporal features, which we calibrate to a 0..1
"predicted theft odds" index. Bicycle theft has no NIBRS category, so "All Other
Larceny" is used as a documented proxy.

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
ZONE_MIN_COUNT = 5      # neighborhoods need >=5 incidents to get a card
WINDOW_LABEL = "2026 YTD"


# ---------------------------------------------------------------- helpers
def iso(epoch_ms):
    if not epoch_ms:
        return None
    return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).isoformat()


def hour_of(epoch_ms):
    if not epoch_ms:
        return None
    # Shift to Atlanta local (UTC-4 in summer) for plausible hour-of-day.
    return datetime.fromtimestamp(epoch_ms / 1000 - 4 * 3600, tz=timezone.utc).hour


def kde_scores(lats, lngs):
    """Gaussian KDE density at each point from all points, normalized 0..1."""
    la = np.asarray(lats)
    ln = np.asarray(lngs)
    n = len(la)
    out = np.zeros(n)
    inv2bw2 = 1.0 / (2 * KDE_BW * KDE_BW)
    for i in range(n):
        dlat = la - la[i]
        dlng = ln - ln[i]
        d2 = dlat * dlat + dlng * dlng
        out[i] = np.exp(-d2 * inv2bw2).sum()
    out = out / out.max()
    return out


def kde_at(plat, plng, lats, lngs):
    la = np.asarray(lats)
    ln = np.asarray(lngs)
    d2 = (la - plat) ** 2 + (ln - plng) ** 2
    return float(np.exp(-d2 / (2 * KDE_BW * KDE_BW)).sum())


def poisson_fit(X, y, iters=4000, lr=0.05, l2=1e-3):
    """Poisson regression by gradient ascent on the log-likelihood.
    Returns coefficients beta for lambda = exp(X @ beta)."""
    beta = np.zeros(X.shape[1])
    for _ in range(iters):
        eta = np.clip(X @ beta, -20, 20)
        lam = np.exp(eta)
        grad = X.T @ (y - lam) - l2 * beta
        beta = beta + lr * grad / len(y)
    return beta


# ---------------------------------------------------------------- main
def main():
    with open(RAW_PATH, encoding="utf-8") as fp:
        rows = json.load(fp)
    rows = [r for r in rows if r.get("lat") and r.get("lng")]
    lats = [r["lat"] for r in rows]
    lngs = [r["lng"] for r in rows]
    print(f"Loaded {len(rows)} real incidents")

    # ---- KDE risk surface (per-incident weight) ----
    risk = kde_scores(lats, lngs)
    contrast = np.power(risk, 0.65)  # lift mid-range for a punchier heatmap

    heat_points = [
        {"lat": rows[i]["lat"], "lng": rows[i]["lng"], "w": round(float(contrast[i]), 4)}
        for i in range(len(rows))
    ]

    # ---- Neighborhood aggregation + temporal features ----
    zmap = {}
    for i, r in enumerate(rows):
        hood = r.get("hood") or "Unknown"
        z = zmap.setdefault(
            hood,
            {"label": hood, "lat": 0.0, "lng": 0.0, "count": 0, "night": 0, "weekend": 0},
        )
        z["lat"] += r["lat"]
        z["lng"] += r["lng"]
        z["count"] += 1
        h = hour_of(r.get("t"))
        if h is not None and (h >= 18 or h < 6):
            z["night"] += 1
        dow = (r.get("dow") or "").lower()
        if dow.startswith("sat") or dow.startswith("sun"):
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
            }
        )
    print(f"{len(zones)} neighborhoods with >= {ZONE_MIN_COUNT} incidents")

    # ---- Poisson regression: expected incident rate per neighborhood ----
    feat_names = ["intercept", "log_density", "night_share", "weekend_share"]
    raw_feats = np.array(
        [
            [1.0, math.log(z["density"] + 1e-6), z["nightShare"], z["weekendShare"]]
            for z in zones
        ]
    )
    # standardize non-intercept columns
    mu = raw_feats[:, 1:].mean(axis=0)
    sd = raw_feats[:, 1:].std(axis=0) + 1e-9
    X = raw_feats.copy()
    X[:, 1:] = (raw_feats[:, 1:] - mu) / sd
    y = np.array([z["count"] for z in zones], dtype=float)

    beta = poisson_fit(X, y)
    lam = np.exp(np.clip(X @ beta, -20, 20))  # predicted expected count

    # Calibrate predicted rate -> 0..1 "predicted theft odds" index (logistic on z-score)
    lo = math.log(lam.min() + 1e-6)
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
        del z["density"]
    zones.sort(key=lambda z: z["stolenProbability"], reverse=True)
    for rank, z in enumerate(zones):
        z["id"] = f"z-{rank}"

    # ---- Real theft markers: most-recent sample (kept small to avoid clutter) ----
    order = sorted(range(len(rows)), key=lambda i: rows[i].get("t") or 0, reverse=True)
    sample = order[:MARKER_SAMPLE]
    incidents = []
    for i in sample:
        r = rows[i]
        hood = r.get("hood") or "Atlanta"
        incidents.append(
            {
                "id": f"apd-{i}",
                "type": "theft",
                "title": f"Larceny reported — {hood}",
                "description": "APD-reported larceny (NIBRS 'All Other Larceny'), "
                "used as a bike-theft risk proxy.",
                "lat": r["lat"],
                "lng": r["lng"],
                "timestamp": iso(r.get("t")),
                "riskWeight": round(float(contrast[i]), 3),
                "neighborhood": hood,
                "source": "apd",
            }
        )

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "heat-points.json"), "w", encoding="utf-8") as f:
        json.dump(heat_points, f)
    with open(os.path.join(OUT_DIR, "incidents.json"), "w", encoding="utf-8") as f:
        json.dump(incidents, f, indent=0)
    with open(os.path.join(OUT_DIR, "zones.json"), "w", encoding="utf-8") as f:
        json.dump(zones, f, indent=0)
    with open(os.path.join(OUT_DIR, "model.json"), "w", encoding="utf-8") as f:
        json.dump(
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
            },
            f,
            indent=2,
        )

    print(f"Top zones by predicted theft odds:")
    for z in zones[:8]:
        print(f"  {int(z['stolenProbability']*100):>3}%  {z['label']}  (n={z['count']})")
    print(f"\nWrote heat-points({len(heat_points)}), incidents({len(incidents)}), "
          f"zones({len(zones)}), model.json -> {OUT_DIR}")
    print("Coefficients:", {feat_names[k]: round(float(beta[k]), 3) for k in range(len(beta))})


if __name__ == "__main__":
    main()
