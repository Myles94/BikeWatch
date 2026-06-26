# BikeWatch

**Live bike-theft intelligence for cities.** BikeWatch turns real police data and
community reports into a live risk map, a predictive hotspot model, safer
routing, and an AI safety assistant, so riders can avoid theft before it happens.

Demo city: **Atlanta, GA** (the platform is city-agnostic and ships with a
multi-city network mode).

---

## Highlights

- **Predictive risk model** trained on real Atlanta PD data. Its top 5% of
  hotspots capture roughly a third of the next thefts, about 7x better than
  chance (held-out validation).
- **Live theft map** rendering every real incident as a dot, plus a toggleable
  density heatmap (smooth blob and hex-grid styles) that shifts by hour of day.
- **Community crowdsourcing** of theft reports and "found bike" sightings, with
  rider-to-rider matching that reunites stolen bikes with their owners.
- **APD dispatch hand-off** that escalates a report and walks the case through
  submitted, acknowledged, responding, and resolved.
- **Safe vs fast routing** that scores real street routes against the theft-risk
  field and steers around the worst zones.
- **Ask BikeWatch**, a location and time aware assistant that answers questions
  and flies the map to the relevant hotspots.
- **Multi-city network mode** to fly between city hubs, plus a cinematic guided
  demo tour for presentations.

## How the model works

The data pipeline (`data-pipeline/`) builds the risk layer from Atlanta Police
Department open data. Because NIBRS has no bicycle category, "All Other Larceny"
is used as a documented bike-theft proxy.

1. **Risk surface** - a Gaussian kernel density estimate (KDE) over the real
   incidents produces a smooth, per-point risk weight (the heatmap).
2. **Predictive model** - a Poisson regression (trained in NumPy via gradient
   ascent) predicts each neighborhood's expected theft rate from spatial density
   plus night-share and weekend-share features, calibrated to a 0..1 theft-odds
   index that drives the zone risk tiers.
3. **Temporal model** - per-zone weekday/weekend by 24-hour multipliers let risk
   "breathe" by the hour and power the time scrubber.
4. **Validation** - an older-70% / newer-30% train/test split reports the
   predictive accuracy index (PAI): how much of held-out future theft the top
   hotspots capture.

The pipeline emits static JSON to `app/public/data/`, so the app has no runtime
ML dependency and never fails on stage.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS v3 |
| Mapping | MapLibre GL JS with a custom dark style |
| Basemap tiles | OpenFreeMap (OpenMapTiles schema, no API key) |
| Routing | OSRM (public API), re-scored against the risk model |
| Data / ML | Python + NumPy (KDE + Poisson regression), static JSON output |
| Assistant | Deterministic, location-aware intent classifier (no external LLM) |

## Project structure

```
BikeWatch/
├─ app/                      # Vite + React frontend
│  ├─ public/
│  │  ├─ data/               # generated risk JSON (heat-points, zones, temporal, model)
│  │  └─ reports/            # incident photos (offline-safe)
│  └─ src/
│     ├─ components/         # MapView, CopilotDock, ReportModal, DemoTour, ...
│     ├─ lib/                # model glue: geo, routing, copilot, temporal, mapStyle, theme
│     ├─ data/               # seeded demo incidents, zones, routes
│     └─ App.tsx             # app shell + demo tour orchestration
└─ data-pipeline/            # Python: fetch APD data + build the risk model
   ├─ fetch_crime.py
   └─ build_risk.py
```

## Getting started

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run lint     # oxlint
```

No API keys are required: the basemap uses OpenFreeMap and routing uses the
public OSRM API.

### Regenerate the risk data (optional)

```bash
cd data-pipeline
python fetch_crime.py     # pull APD "All Other Larceny" incidents
python build_risk.py      # build the KDE + regression risk layer
```

Requires Python 3 and NumPy. See `data-pipeline/README.md` for details.

## Design notes

- **Real:** the map, heatmap and zone analytics, the KDE + regression risk model
  and its validation, incident reporting, sighting-to-theft matching, and the
  routing risk scoring.
- **Seeded for the demo:** the curated featured incidents, safe zones, and the
  mock data behind the multi-city network mode.
- The assistant is deterministic (no external LLM) so it is instant and never
  fails live; it is swappable for an LLM later via `lib/copilot.ts`.
