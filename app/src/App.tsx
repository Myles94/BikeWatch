import { useMemo, useState } from 'react';
import MapView from './components/MapView';
import CopilotPanel from './components/CopilotPanel';
import ReportModal from './components/ReportModal';
import type { Incident } from './lib/types';
import {
  SEED_INCIDENTS,
  SEED_ROUTES,
  SEED_SAFE_ZONES,
  CITY,
} from './data/incidents';
import { runCopilot } from './lib/copilot';
import { computeHotspots } from './lib/geo';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [reportMode, setReportMode] = useState(false);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [highlightZoneId, setHighlightZoneId] = useState<string | null>(null);
  const [avoidHotspot, setAvoidHotspot] = useState<
    { lat: number; lng: number; label: string } | null
  >(null);
  const [mapReady, setMapReady] = useState(false);

  const hotspots = useMemo(() => computeHotspots(incidents), [incidents]);
  const theftCount = incidents.filter((i) => i.type === 'theft').length;

  const activeRoute = useMemo(
    () => SEED_ROUTES.find((r) => r.id === activeRouteId) ?? null,
    [activeRouteId],
  );

  const handleMapClick = (lng: number, lat: number) => {
    if (!reportMode) return;
    setModalCoords({ lat, lng });
    setModalOpen(true);
    setReportMode(false);
  };

  const handleSubmitReport = (data: Omit<Incident, 'id' | 'timestamp' | 'isNew'>) => {
    const incident: Incident = {
      ...data,
      id: `user-${Date.now()}`,
      timestamp: new Date().toISOString(),
      isNew: true,
    };
    setIncidents((prev) => [...prev, incident]);
    setModalOpen(false);
    setModalCoords(null);
  };

  const handleAsk = (question: string) => {
    const origin = { lat: CITY.center[1], lng: CITY.center[0], label: 'your location' };
    const res = runCopilot(question, {
      origin,
      incidents,
      safeZones: SEED_SAFE_ZONES,
      routes: SEED_ROUTES,
    });
    // Wire AI output to visible map actions
    setActiveRouteId(null);
    setHighlightZoneId(null);
    setAvoidHotspot(null);
    const rec = res.recommendation;
    if (rec?.kind === 'route' && rec.routeId) setActiveRouteId(rec.routeId);
    if (rec?.kind === 'parking' && rec.safeZoneId) setHighlightZoneId(rec.safeZoneId);
    if (rec?.kind === 'avoid' && rec.avoidHotspot) setAvoidHotspot(rec.avoidHotspot);
    return res;
  };

  return (
    <div className="relative h-full w-full bg-ink">
      {/* Map hero */}
      <MapView
        incidents={incidents}
        safeZones={SEED_SAFE_ZONES}
        activeRoute={activeRoute}
        highlightZoneId={highlightZoneId}
        avoidHotspot={avoidHotspot}
        onMapClick={handleMapClick}
        onReady={() => setMapReady(true)}
      />

      {/* Top gradient for legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/90 to-transparent" />

      {/* Header / branding */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-edge bg-panel/80 px-4 py-2.5 backdrop-blur-md">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-ink shadow-glow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M5.5 17.5 9 7h4l3 7m-6.5 3.5h7M13 7l2.5 4" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold leading-none tracking-tight">
              Bike<span className="text-brand">Watch</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              Real-time theft intelligence · {CITY.name}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="pointer-events-auto flex gap-2.5">
          <StatCard label="Incidents" value={incidents.length} accent="text-danger" />
          <StatCard label="Thefts (48h)" value={theftCount} accent="text-warn" />
          <StatCard label="Hotspots" value={hotspots.filter((h) => h.score >= 1.5).length} accent="text-brand" />
        </div>
      </header>

      {/* Loading shimmer until map ready */}
      {!mapReady && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ink">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-edge border-t-brand" />
            <div className="text-sm text-slate-400">Loading live risk map…</div>
          </div>
        </div>
      )}

      {/* Report-mode banner */}
      {reportMode && (
        <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 animate-slideUp rounded-full border border-brand bg-panel/90 px-4 py-2 text-sm text-brand shadow-glow backdrop-blur-md">
          📍 Click anywhere on the map to drop your report
        </div>
      )}

      {/* Bottom-left: legend + report CTA */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-3">
        <Legend />
        <button
          onClick={() => setReportMode((v) => !v)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg transition ${
            reportMode
              ? 'border border-brand bg-brand/15 text-brand'
              : 'bg-danger text-white hover:bg-red-600'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {reportMode ? 'Cancel report' : 'Report incident'}
        </button>
      </div>

      {/* Right: Copilot panel */}
      <aside className="absolute right-4 top-20 bottom-4 z-20 flex w-[360px] max-w-[88vw] flex-col overflow-hidden rounded-2xl border border-edge bg-panel/85 shadow-2xl backdrop-blur-md">
        <CopilotPanel onAsk={handleAsk} />
      </aside>

      <ReportModal
        open={modalOpen}
        coords={modalCoords}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-panel/80 px-3.5 py-2 text-center backdrop-blur-md">
      <div className={`text-lg font-bold leading-none ${accent}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-xl border border-edge bg-panel/80 px-3.5 py-3 backdrop-blur-md">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        Theft risk
      </div>
      <div className="h-2 w-44 rounded-full bg-gradient-to-r from-brand via-warn to-danger" />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Low</span>
        <span>High</span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <LegendRow color="bg-danger" label="Theft report" />
        <LegendRow color="bg-warn" label="Suspicious activity" />
        <LegendRow color="bg-safe" label="Safe zone" />
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
