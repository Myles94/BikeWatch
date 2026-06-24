import { CITIES, NETWORK_TOTAL } from '../lib/cities';

interface CityNetworkProps {
  open: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function CityNetwork({ open, selectedId, onSelect }: CityNetworkProps) {
  if (!open) return null;
  const selected = CITIES.find((c) => c.id === selectedId);

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div className="tac-panel pointer-events-auto animate-slideUp overflow-hidden">
        <div className="flex items-center gap-3 border-b border-edge px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--signal)] animate-livePulse" />
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            BikeWatch Network
          </span>
          <span className="mono text-[10px] tracking-[0.1em] text-muted">
            Optimized for Atlanta · deployable anywhere
          </span>
          <span className="mono ml-auto text-[10px] tracking-[0.08em] text-brand">
            {selected
              ? `${selected.name.toUpperCase()} · ${selected.incidents.toLocaleString()} incidents`
              : `${NETWORK_TOTAL.toLocaleString()} incidents tracked`}
          </span>
        </div>
        <div className="flex items-stretch gap-1 px-2 py-2">
          <button
            onClick={() => onSelect('')}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 transition ${
              !selectedId ? 'bg-brand text-[color:var(--on-signal)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="font-display text-[12px] font-bold uppercase tracking-[0.1em]">USA</span>
            <span
              className={`mono text-[8px] uppercase tracking-[0.12em] ${!selectedId ? 'text-[color:var(--on-signal)]' : 'text-muted'}`}
            >
              National
            </span>
          </button>
          <span className="my-1 w-px self-stretch bg-edge" />
          {CITIES.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-2 transition ${
                  active ? 'bg-brand text-[color:var(--on-signal)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="font-display text-[12px] font-bold uppercase tracking-[0.1em]">
                  {c.short}
                </span>
                <span
                  className={`mono text-[8px] uppercase tracking-[0.12em] ${active ? 'text-[color:var(--on-signal)]' : 'text-muted'}`}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
