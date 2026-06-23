import { useState } from 'react';
import type { RouteOption, TripPlan, TripPoint } from '../lib/types';

interface TripPlannerProps {
  open: boolean;
  onClose: () => void;
  points: TripPoint[];
  trip: TripPlan | null;
  onPlan: (origin: TripPoint, destination: TripPoint) => void;
  onSelect: (id: 'safe' | 'direct') => void;
  onClear: () => void;
}

export default function TripPlanner({
  open,
  onClose,
  points,
  trip,
  onPlan,
  onSelect,
  onClear,
}: TripPlannerProps) {
  const [originId, setOriginId] = useState(points[0]?.id ?? '');
  const [destId, setDestId] = useState(points[2]?.id ?? points[1]?.id ?? '');

  if (!open) return null;

  const byId = (id: string) => points.find((p) => p.id === id);
  const sameEndpoints = originId === destId;

  const plan = () => {
    const o = byId(originId);
    const d = byId(destId);
    if (o && d && o.id !== d.id) onPlan(o, d);
  };

  const swap = () => {
    setOriginId(destId);
    setDestId(originId);
  };

  return (
    <div className="absolute left-4 top-[84px] z-30 w-[300px] max-w-[88vw]">
      <div className="tac-panel animate-slideUp p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center border border-brand/50 bg-brand/10 text-brand">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17h4l3-10 3 14 3-9h4" />
          </svg>
        </span>
        <span className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          Route Planner
        </span>
        <button
          onClick={onClose}
          className="ml-auto grid h-6 w-6 place-items-center text-muted transition hover:bg-white/5 hover:text-white"
          aria-label="Close planner"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {/* From / To */}
      <label className="tac-label mb-1 block">From</label>
      <Picker
        accent="brand"
        value={originId}
        points={points}
        onChange={setOriginId}
      />
      <div className="my-1.5 flex items-center">
        <span className="h-px flex-1 bg-edge" />
        <button
          onClick={swap}
          className="mx-2 grid h-6 w-6 place-items-center border border-edge text-muted transition hover:border-brand/60 hover:text-brand"
          aria-label="Swap"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></svg>
        </button>
        <span className="h-px flex-1 bg-edge" />
      </div>
      <label className="tac-label mb-1 block">To</label>
      <Picker accent="safe" value={destId} points={points} onChange={setDestId} />

      <button
        onClick={plan}
        disabled={sameEndpoints}
        className="mono mt-3 w-full bg-brand py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a1300] transition hover:bg-brand-2 disabled:opacity-40"
      >
        {trip ? 'Replan safest route' : 'Find safest route'}
      </button>
      {sameEndpoints && (
        <div className="mono mt-1.5 text-[9px] uppercase tracking-[0.1em] text-muted">
          Pick two different points
        </div>
      )}

      {/* Results */}
      {trip && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="tac-label">Route options</span>
            <button
              onClick={onClear}
              className="mono text-[9px] uppercase tracking-[0.1em] text-muted transition hover:text-white"
            >
              Clear
            </button>
          </div>
          {trip.options.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              selected={trip.selectedId === o.id}
              onSelect={() => onSelect(o.id)}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function Picker({
  value,
  points,
  onChange,
  accent,
}: {
  value: string;
  points: TripPoint[];
  onChange: (id: string) => void;
  accent: 'brand' | 'safe';
}) {
  return (
    <div className="flex items-center gap-2 border border-edge bg-panel-2 px-2.5 py-2 focus-within:border-brand/60">
      <span className={`h-2 w-2 rounded-full ${accent === 'brand' ? 'bg-brand' : 'bg-safe'}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mono w-full cursor-pointer appearance-none bg-transparent text-[12px] text-slate-100 focus:outline-none"
      >
        {points.map((p) => (
          <option key={p.id} value={p.id} className="bg-panel text-slate-100">
            {p.label}
          </option>
        ))}
      </select>
      <svg className="text-muted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: RouteOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const isSafe = option.kind === 'safe';
  const accent = isSafe ? 'var(--safe)' : 'var(--theft)';
  const score = option.safetyScore;
  return (
    <button
      onClick={onSelect}
      className={`block w-full border-l-2 px-3 py-2.5 text-left transition ${
        selected
          ? 'border border-l-2 bg-white/[0.05]'
          : 'border border-l-2 border-edge bg-white/[0.02] opacity-75 hover:opacity-100'
      }`}
      style={{
        borderLeftColor: accent,
        borderColor: selected ? accent : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <span className="mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
            {option.label}
          </span>
          {selected && (
            <span className="mono text-[8px] uppercase tracking-[0.12em] text-muted">· active</span>
          )}
        </span>
        <span className="mono text-[16px] font-bold leading-none text-white">
          {score}
          <span className="ml-0.5 text-[8px] text-muted">SAFE</span>
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full bg-white/[0.07]">
        <span className="block h-full" style={{ width: `${score}%`, background: accent }} />
      </div>
      <div className="mono mt-2 flex items-center gap-3 text-[9px] uppercase tracking-[0.08em] text-muted">
        <span>{option.distanceKm.toFixed(1)} km</span>
        <span>{option.etaMin} min</span>
        <span>
          {option.hotspotsPassed} hotspot{option.hotspotsPassed === 1 ? '' : 's'}
        </span>
      </div>
    </button>
  );
}
