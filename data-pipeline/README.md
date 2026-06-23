# BikeWatch data pipeline

Builds the real-data risk layer from **Atlanta Police Department open data**
(ArcGIS Hub, `OpenDataWebsite_Crime_view` — NIBRS crime records).

## Important: bike-theft proxy
NIBRS has **no bicycle or scooter category**. Bicycle theft is coded as
**"All Other Larceny"**, so the pipeline uses that offense as a documented
proxy for bike-theft risk. E-scooter thefts are not separately recorded.

## Stages
1. `fetch_crime.py` — queries the ArcGIS FeatureServer for "All Other Larceny"
   incidents (2026 YTD, greater-Atlanta bbox) and writes `out/raw_larceny.json`.
2. `build_risk.py` — builds a Gaussian-KDE risk surface and trains a Poisson
   regression (numpy gradient ascent) on spatial density + temporal features to
   predict per-neighborhood theft odds. Writes the app data files.

## Outputs (committed) → `app/public/data/`
- `heat-points.json` — KDE-weighted incidents for the heatmap
- `incidents.json` — sampled real theft markers
- `zones.json` — per-neighborhood stats + model-predicted theft odds
- `model.json` — model metadata (method, coefficients, provenance)

## Regenerate
```sh
python fetch_crime.py
python build_risk.py
```
Requires Python 3 + numpy (stdlib otherwise). To change the time window, edit
`SINCE` in `fetch_crime.py`.
