# BikeWatch frontend

Vite + React 19 + TypeScript + Tailwind + MapLibre GL. See the
[root README](../README.md) for the full project overview, the risk model, and
the tech stack.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run lint     # oxlint
```

- `src/components/` UI (MapView, CopilotDock, ReportModal, DemoTour, ...)
- `src/lib/` model glue (geo, routing, copilot, temporal, mapStyle, theme)
- `src/data/` seeded demo incidents, zones, routes
- `public/data/` generated risk JSON from `../data-pipeline`

No API keys required: OpenFreeMap basemap tiles and the public OSRM routing API.
