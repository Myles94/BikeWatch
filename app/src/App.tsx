import { useMemo, useState } from 'react';
import MapView from './components/MapView';
import CopilotDock from './components/CopilotDock';
import ReportModal from './components/ReportModal';
import type { Incident } from './lib/types';
import { SEED_INCIDENTS, SEED_ROUTES, SEED_SAFE_ZONES, CITY } from './data/incidents';
import { runCopilot } from './lib/copilot';
import { computeHotspots } from './lib/geo';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const [reportMode, setReportMode] = useState(false);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [highlightZoneId, setHighlightZoneId] = useState<string | null>(null);
  const [avoidHotspot, setAvoidHotspot] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const hotspots = useMemo(() => computeHotspots(incidents), [incidents]);
  const theftCount = incidents.filter((i) => i.type === 'theft').length;
  const hotspotCount = hotspots.filter((h) => h.score >= 1.5).length;

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
    setActiveRouteId(null);
    setHighlightZoneId(null);
    setAvoidHotspot(null);
    const rec = res.recommendation;
    if (rec?.kind === 'route' && rec.routeId) setActiveRouteId(rec.routeId);
    if (rec?.kind === 'parking' && rec.safeZoneId) setHighlightZoneId(rec.safeZoneId);
    if (rec?.kind === 'avoid' && rec.avoidHotspot) {
      setAvoidHotspot(rec.avoidHotspot);
      setShowHeatmap(true);
    }
    return res;
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <MapView
        incidents={incidents}
        safeZones={SEED_SAFE_ZONES}
        activeRoute={activeRoute}
        highlightZoneId={highlightZoneId}
        avoidHotspot={avoidHotspot}
        showHeatmap={showHeatmap}
        onMapClick={handleMapClick}
        onReady={() => setMapReady(true)}
      />

      {/* subtle vignette for legibility */}
      <div className="pointer-events-none absolute inset-0 z-10 [box-shadow:inset_0_0_180px_60px_rgba(3,6,12,0.65)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-ink/80 to-transparent" />

      {/* ---------- Top bar ---------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-[#04222a] shadow-[0_0_18px_rgba(34,211,238,0.45)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.3" />
              <circle cx="18.5" cy="17.5" r="3.3" />
              <path d="M5.5 17.5 9 7h4l3 7m-6.5 3.5h7M13 7l2.5 4" />
            </svg>
          </span>
          <div className="leading-none">
            <div className="text-[15px] font-bold tracking-tight">
              Bike<span className="text-brand">Watch</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-danger shadow-[0_0_6px_#ef4444]" />
              Live · {CITY.name}
            </div>
          </div>
        </div>

        {/* Control cluster */}
        <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0a101c]/70 px-2 py-1.5 backdrop-blur-xl">
          <Stat label="Incidents" value={incidents.length} tone="text-slate-100" />
          <Stat label="Thefts" value={theftCount} tone="text-danger" />
          <Stat label="Hot zones" value={hotspotCount} tone="text-warn" />
          <span className="mx-0.5 h-7 w-px bg-white/10" />
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition ${
              showHeatmap
                ? 'bg-brand text-[#04222a] shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c2.5 3 5 5.4 5 9a5 5 0 0 1-10 0c0-1.4.5-2.6 1.2-3.7" />
            </svg>
            Heatmap
          </button>
        </div>
      </header>

      {/* ---------- Loading ---------- */}
      {!mapReady && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-brand" />
            <div className="text-[13px] tracking-wide text-slate-400">Loading live risk map…</div>
          </div>
        </div>
      )}

      {/* ---------- Report-mode banner ---------- */}
      {reportMode && (
        <div className="absolute left-1/2 top-[68px] z-30 -translate-x-1/2 animate-slideUp">
          <div className="flex items-center gap-2 rounded-full border border-brand/40 bg-[#0a101c]/90 px-4 py-2 text-[13px] text-brand backdrop-blur-md">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
            Click anywhere on the map to drop your report
          </div>
        </div>
      )}

      {/* ---------- Bottom-left: legend + report ---------- */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-3">
        <Legend showHeatmap={showHeatmap} />
        <button
          onClick={() => setReportMode((v) => !v)}
          className={`flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
            reportMode
              ? 'border border-brand/50 bg-brand/10 text-brand'
              : 'bg-danger text-white shadow-[0_8px_24px_rgba(239,68,68,0.35)] hover:bg-red-600'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {reportMode ? 'Cancel report' : 'Report incident'}
        </button>
      </div>

      {/* ---------- Copilot dock ---------- */}
      <CopilotDock open={copilotOpen} onOpenChange={setCopilotOpen} onAsk={handleAsk} />

      <ReportModal
        open={modalOpen}
        coords={modalCoords}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-2.5 py-0.5 text-center">
      <div className={`tabular text-[17px] font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-1 text-[9.5px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}

function Legend({ showHeatmap }: { showHeatmap: boolean }) {
  return (
    <div className="w-[188px] rounded-2xl border border-white/8 bg-[#0a101c]/70 px-3.5 py-3 backdrop-blur-xl">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {showHeatmap ? 'Theft density' : 'Map key'}
      </div>
      {showHeatmap ? (
        <>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-brand via-warn to-danger" />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>Low</span>
            <span>High</span>
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Row color="bg-danger" label="Theft report" />
          <Row color="bg-warn" label="Suspicious activity" />
          <Row color="bg-safe" label="Verified safe zone" />
        </div>
      )}
    </div>
  );
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
