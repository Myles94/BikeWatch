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

No API keys required — the map uses **OpenFreeMap** (free, no key, no rate limits)
with a custom cinematic dark style, so the demo never breaks on a missing token.

## What's in the MVP

| Feature | Status |
| --- | --- |
| 1. Interactive risk map (seeded Atlanta incidents, rich dark geography) | ✅ real |
| 2. Heatmap toggle → advanced shaded heatmap + per-zone risk analytics | ✅ real (MapLibre heatmap) |
| 3. Incident reporting flow → new pin + heat updates | ✅ real |
| 4. AI Copilot dock (parking / avoid / route / risk) | ✅ deterministic, location-aware |
| 5. Safer route + safe-zone recommendation drawn on map | ✅ real |

Reports are visible on load; the **Heatmap** button reveals the shaded density
layer with risk-tier cards on each hotspot zone. The **Copilot** opens from a
launcher and can be toggled closed — it never permanently covers the map.

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
├─ MapView ......... MapLibre GL + custom OpenFreeMap dark style (lib/mapStyle)
│                    • 3D buildings, water, parks, strong labels
│                    • advanced heatmap layer (toggle) + zone analytics
│                    • incident / safe-zone markers, image popups
│                    • safer-route line (glow + core)
├─ CopilotDock ..... toggleable chat launcher → runCopilot()
├─ ReportModal ..... add incident → updates state → map re-renders
│
├─ data/incidents.ts ... seeded Atlanta incidents (+ real photos), zones, routes
├─ public/reports/ ..... downloaded bike/e-scooter photos (offline-safe)
└─ lib/
   ├─ mapStyle.ts ...... custom cinematic dark basemap style
   ├─ geo.ts ........... haversine, hotspot clustering, zone analytics
   └─ copilot.ts ....... intent classifier + deterministic safety responses
```

**Real:** map, heatmap + zone analytics, markers, reporting, hotspot math,
copilot wiring to map actions. **Mocked/seeded:** incident data, safe zones, the
one demo route, and the copilot's deterministic logic (no external LLM, so it's
instant and never fails on stage). Swappable for an LLM later via `runCopilot`.
