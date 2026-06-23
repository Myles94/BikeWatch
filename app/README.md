# 🚲 BikeWatch — Live Bike-Theft Intelligence

Real-time bike-theft awareness and prevention. BikeWatch turns scattered theft
reports into a live risk map, hotspot heatmap, and an AI **safety copilot** that
recommends safer parking and routes.

**Demo city:** Atlanta, GA.

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

No API keys required — the map uses the free CARTO dark-matter vector style, so
the demo never breaks on a missing token.

## What's in the MVP

| Feature | Status |
| --- | --- |
| 1. Interactive risk map (seeded Atlanta incidents) | ✅ real |
| 2. Hotspot heatmap (cyan → yellow → orange → red) | ✅ real (MapLibre heatmap) |
| 3. Incident reporting flow → new pin + heat updates | ✅ real |
| 4. AI Copilot (parking / avoid / route / risk) | ✅ deterministic, location-aware |
| 5. Safer route + safe-zone recommendation drawn on map | ✅ real |

## Demo click-path

1. App opens on a cinematic dark Atlanta map with glowing theft hotspots
   (Georgia Tech, Midtown, Downtown).
2. Click **Report incident** → click the map → submit. A pulsing pin drops and
   the heatmap intensifies.
3. Ask the Copilot **"What's the safest route home?"** → a green safer route is
   drawn, avoiding the hotspots.
4. Ask **"Where is it safer to park nearby?"** → the nearest 🛡 safe zone is
   highlighted with its rationale.
5. Ask **"What areas should I avoid?"** → the map flies to the #1 hotspot.

## Architecture

```
React + TS + Tailwind (Vite)
│
├─ MapView ......... MapLibre GL + CARTO dark style
│                    • heatmap layer (riskWeight)
│                    • incident / safe-zone markers
│                    • safer-route line (glow + core)
├─ CopilotPanel .... chat UI → runCopilot()
├─ ReportModal ..... add incident → updates state → map re-renders
│
├─ data/incidents.ts ... seeded Atlanta incidents, safe zones, routes
└─ lib/
   ├─ geo.ts ........... haversine, hotspot clustering, nearest safe zone
   └─ copilot.ts ....... intent classifier + deterministic safety responses
```

**Real:** map, heatmap, markers, reporting, hotspot math, copilot wiring to map
actions. **Mocked/seeded:** incident data, safe zones, the one demo route, and
the copilot's deterministic logic (no external LLM, so it's instant and never
fails on stage). Swappable for an LLM later via `runCopilot`.
