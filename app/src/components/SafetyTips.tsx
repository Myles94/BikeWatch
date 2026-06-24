interface SafetyTipsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPS = [
  'Lock the frame and a wheel to a fixed rack with a hardened U-lock.',
  'Park in lit, busy, camera-covered spots. Avoid isolated racks.',
  'Take your lights, bag, and any quick-release wheel with you.',
  'Save your serial number so a found bike can be matched to you.',
  'Vary where you park. Thieves watch routines.',
];

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function SafetyTips({ open, onOpenChange }: SafetyTipsProps) {
  return (
    <div className="pointer-events-none absolute bottom-5 right-[176px] z-30 flex flex-col items-end gap-3">
      {/* Panel */}
      <div
        className={`tac-panel pointer-events-auto w-[300px] max-w-[88vw] origin-bottom-right overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-200 ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0'
        }`}
        style={{ height: open ? 'auto' : 0 }}
      >
        <div className="flex items-center gap-2.5 border-b border-edge px-4 py-3">
          <span className="grid h-8 w-8 place-items-center border border-safe/50 bg-safe/10 text-safe">
            <ShieldIcon />
          </span>
          <div className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-white">
            Safety Tips
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-auto grid h-7 w-7 place-items-center text-muted transition hover:bg-white/5 hover:text-white"
            aria-label="Close safety tips"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <ul className="space-y-2.5 px-4 py-3.5">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-slate-200">
              <span className="mono mt-px text-[10px] text-safe">{String(i + 1).padStart(2, '0')}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Launcher */}
      <button
        onClick={() => onOpenChange(!open)}
        className={`pointer-events-auto flex items-center gap-2 border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] shadow-lg transition ${
          open ? 'border-safe bg-safe/15 text-safe' : 'border-edge bg-panel/90 text-slate-300 hover:text-white'
        }`}
      >
        <ShieldIcon />
        Safety Tips
      </button>
    </div>
  );
}
