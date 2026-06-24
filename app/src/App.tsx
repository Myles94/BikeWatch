import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView';
import CopilotDock from './components/CopilotDock';
import ReportModal from './components/ReportModal';
import TripPlanner from './components/TripPlanner';
import TimeScrubber from './components/TimeScrubber';
import type { HeatPoint, Incident, RiskModel, Temporal, TripPlan, TripPoint, Zone } from './lib/types';
import { FEATURED_REPORTS, SEED_ROUTES, SEED_SAFE_ZONES, TRIP_POINTS, CITY } from './data/incidents';
import { runCopilot } from './lib/copilot';
import { planTrip } from './lib/routing';
import { loadRiskData } from './lib/loadData';
import { type DayType, nowSelection, weightedHeatPoints } from './lib/temporal';

export default function App() {
  const [realIncidents, setRealIncidents] = useState<Incident[]>([]);
  const [userIncidents, setUserIncidents] = useState<Incident[]>([]);
  const [rawHeatPoints, setRawHeatPoints] = useState<HeatPoint[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [temporal, setTemporal] = useState<Temporal | null>(null);
  const [model, setModel] = useState<RiskModel | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Temporal scrubber state
  const [time, setTime] = useState(nowSelection);
  const [playing, setPlaying] = useState(false);

  const [reportMode, setReportMode] = useState(false);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [tripOpen, setTripOpen] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [originId, setOriginId] = useState('tp-you');
  const [destId, setDestId] = useState('tp-dt');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null);

  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [highlightZoneId, setHighlightZoneId] = useState<string | null>(null);
  const [avoidHotspot, setAvoidHotspot] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load the real-data risk layer (APD pipeline output) once.
  useEffect(() => {
    loadRiskData().then((d) => {
      setRealIncidents(d.incidents);
      setRawHeatPoints(d.heatPoints);
      setZones(d.zones);
      setTemporal(d.temporal);
      setModel(d.model);
    });
  }, []);

  // Animate the hour while playing.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setTime((s) => ({ ...s, hour: (s.hour + 1) % 24 })), 750);
    return () => clearInterval(t);
  }, [playing]);

  // Time-weighted heatmap points (shift by hour-of-day profile).
  const heatPoints = useMemo(
    () => weightedHeatPoints(rawHeatPoints, temporal, time),
    [rawHeatPoints, temporal, time],
  );

  // Scan-line re-mount key — increments each time the heatmap engages
  const [scanKey, setScanKey] = useState(0);
  const prevHeat = useRef(false);
  useEffect(() => {
    if (showHeatmap && !prevHeat.current) setScanKey((k) => k + 1);
    if (!showHeatmap) setPlaying(false);
    prevHeat.current = showHeatmap;
  }, [showHeatmap]);

  // Hybrid: curated bike/scooter reports on top of the real larceny sample.
  const incidents = useMemo(
    () => [...FEATURED_REPORTS, ...realIncidents, ...userIncidents],
    [realIncidents, userIncidents],
  );
  const totalIncidents = model?.nIncidents ?? incidents.length;
  const zoneCount = model?.nZones ?? zones.length;
  const highRiskCount = zones.filter((z) => z.tier === 'High').length;

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
    setUserIncidents((prev) => [...prev, incident]);
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
      zones,
      model,
      temporal,
      time,
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

  const handlePlanTrip = async (origin: TripPoint, destination: TripPoint) => {
    setPlanning(true);
    try {
      setTripPlan(await planTrip(origin, destination, zones));
    } finally {
      setPlanning(false);
    }
  };
  const handleSelectRoute = (id: 'safe' | 'fast') =>
    setTripPlan((p) => (p ? { ...p, selectedId: id } : p));
  const handleClearTrip = () => setTripPlan(null);

  const handleLandmarkClick = (p: TripPoint) => {
    setOriginId(p.id);
    setFlyTarget({ lat: p.lat, lng: p.lng, key: Date.now() });
    setTripOpen(true);
  };

  const handleNow = () => {
    setPlaying(false);
    setTime(nowSelection());
  };
  const landmarks = useMemo(() => TRIP_POINTS.filter((p) => p.id !== 'tp-you'), []);
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <MapView
        incidents={incidents}
        heatPoints={heatPoints}
        zones={zones}
        safeZones={SEED_SAFE_ZONES}
        landmarks={landmarks}
        activeRoute={activeRoute}
        highlightZoneId={highlightZoneId}
        avoidHotspot={avoidHotspot}
        flyTarget={flyTarget}
        showHeatmap={showHeatmap}
        trip={tripPlan}
        onMapClick={handleMapClick}
        onLandmarkClick={handleLandmarkClick}
        onReady={() => setMapReady(true)}
      />

      {/* atmosphere: vignette + faint grid for the ops-board feel */}
      <div className="pointer-events-none absolute inset-0 z-10 [box-shadow:inset_0_0_200px_70px_rgba(3,5,10,0.7)]" />
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,176,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,176,0,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* heatmap scan-line sweep */}
      {showHeatmap && (
        <div key={scanKey} className="scanline z-10 animate-scanSweep" />
      )}

      {/* ---------- Top bar ---------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        {/* Wordmark — transit signage */}
        <div className="animate-bootIn flex items-center gap-3" style={{ animationDelay: '60ms' }}>
          <span className="grid h-9 w-9 place-items-center bg-brand text-[#1a1300]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.3" />
              <circle cx="18.5" cy="17.5" r="3.3" />
              <path d="M5.5 17.5 9 7h4l3 7m-6.5 3.5h7M13 7l2.5 4" />
            </svg>
          </span>
          <div className="leading-none">
            <div className="font-display text-[17px] font-extrabold uppercase tracking-[0.14em] text-white">
              Bike<span className="text-brand">Watch</span>
            </div>
            <div className="mono mt-1.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-safe shadow-[0_0_6px_#21d07a] animate-livePulse" />
              Live · Theft Intelligence · {CITY.name}
            </div>
          </div>
        </div>

        {/* Ops cluster */}
        <div
          className="tac-panel animate-bootIn flex items-stretch"
          style={{ animationDelay: '160ms' }}
        >
          <Clock />
          <Divider />
          <Stat label="Incidents" value={totalIncidents} tone="text-white" />
          <Stat label="Zones" value={zoneCount} tone="text-danger" />
          <Stat label="High risk" value={highRiskCount} tone="text-brand" />
          <Divider />
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            className={`flex items-center gap-2 px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
              showHeatmap
                ? 'bg-brand text-[#1a1300]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c2.5 3 5 5.4 5 9a5 5 0 0 1-10 0c0-1.4.5-2.6 1.2-3.7" />
            </svg>
            Heatmap
          </button>
          <Divider />
          <button
            onClick={() => setTripOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
              tripOpen
                ? 'bg-brand text-[#1a1300]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17h4l3-10 3 14 3-9h4" />
            </svg>
            Route
          </button>
        </div>
      </header>

      {/* ---------- Loading ---------- */}
      {!mapReady && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink">
          <div className="flex flex-col items-center gap-4">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-brand" />
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted">
              Initializing risk grid
            </div>
          </div>
        </div>
      )}

      {/* ---------- Report-mode banner ---------- */}
      {reportMode && (
        <div className="absolute left-1/2 top-[76px] z-30 -translate-x-1/2 animate-slideUp">
          <div className="tac-panel flex items-center gap-2 px-4 py-2">
            <svg className="text-brand" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
            <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-200">
              Click map to drop report marker
            </span>
          </div>
        </div>
      )}

      {/* ---------- Trip planner ---------- */}
      <TripPlanner
        open={tripOpen}
        onClose={() => setTripOpen(false)}
        points={TRIP_POINTS}
        originId={originId}
        destId={destId}
        trip={tripPlan}
        planning={planning}
        onOriginId={setOriginId}
        onDestId={setDestId}
        onPlan={handlePlanTrip}
        onSelect={handleSelectRoute}
        onClear={handleClearTrip}
      />

      {/* ---------- Temporal scrubber (heatmap mode) ---------- */}
      {showHeatmap && temporal && (
        <TimeScrubber
          sel={time}
          playing={playing}
          temporal={temporal}
          onHour={(h) => setTime((s) => ({ ...s, hour: h }))}
          onDayType={(d: DayType) => setTime((s) => ({ ...s, dayType: d }))}
          onTogglePlay={() => setPlaying((p) => !p)}
          onNow={handleNow}
        />
      )}

      {/* ---------- Bottom-left: legend + report ---------- */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-3">
        <Legend showHeatmap={showHeatmap} model={model} />
        <button
          onClick={() => setReportMode((v) => !v)}
          className={`animate-bootIn flex w-fit items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
            reportMode
              ? 'border border-brand/60 bg-brand/10 text-brand'
              : 'border border-danger bg-danger text-white hover:bg-[#e03b30]'
          }`}
          style={{ animationDelay: '320ms' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
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

function Divider() {
  return <span className="my-2 w-px self-stretch bg-edge" />;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-3.5 py-2">
      <div className={`mono text-[18px] font-bold leading-none ${tone}`}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="tac-label mt-1.5">{label}</div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <div className="flex flex-col items-center justify-center px-3.5 py-2">
      <div className="mono flex items-center gap-1.5 text-[15px] font-semibold leading-none text-slate-100">
        <span className="h-1.5 w-1.5 rounded-full bg-danger animate-livePulse" />
        {hh}:{mm}:{ss}
      </div>
      <div className="tac-label mt-1.5">Live feed</div>
    </div>
  );
}

function Legend({ showHeatmap, model }: { showHeatmap: boolean; model: RiskModel | null }) {
  return (
    <div
      className="tac-panel animate-bootIn w-[210px] px-3.5 py-3"
      style={{ animationDelay: '240ms' }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="tac-label">{showHeatmap ? 'Risk density' : 'Map key'}</span>
        <span className="mono text-[9px] tracking-[0.06em] text-muted">
          {CITY.center[1].toFixed(3)}, {CITY.center[0].toFixed(3)}
        </span>
      </div>
      {showHeatmap ? (
        <>
          <div className="h-2 w-full bg-gradient-to-r from-safe via-brand to-danger" />
          <div className="mono mt-1.5 flex justify-between text-[8.5px] uppercase tracking-[0.12em] text-muted">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className="mt-3 border-t border-edge pt-2.5">
            <Row color="bg-safe" label="Safe-zone density" />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Row color="bg-danger" label="Theft report" />
          <Row color="bg-brand" label="Suspicious activity" />
          <Row color="bg-safe" label="Verified safe zone" />
        </div>
      )}
      {model && (
        <div className="mono mt-3 border-t border-edge pt-2.5 text-[8px] uppercase leading-relaxed tracking-[0.1em] text-muted">
          <span className="text-brand">●</span> APD open data · {model.nIncidents.toLocaleString()} incidents · {model.window}
          <br />
          Poisson + KDE model · bike-theft proxy
          {model.validation && (
            <>
              <br />
              <span className="text-safe">✓</span> Validated: top-5% hotspots caught{' '}
              <span className="text-white">{Math.round(model.validation.topHotspotCapture * 100)}%</span>{' '}
              of held-out thefts ({model.validation.pai}× chance)
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-300">{label}</span>
    </div>
  );
}
