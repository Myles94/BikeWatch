import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FeedEvent, FeedKind } from '../lib/types';
import { COMMUNITY_HANDLES } from '../data/incidents';

interface CommunityFeedProps {
  open: boolean;
  onToggle: () => void;
  watchersBase: number;
  recovery: { by: string; place: string; key: number } | null;
}

const PLACES = [
  'Midtown',
  'Old Fourth Ward',
  'Downtown',
  'Georgia Tech',
  'Little Five Points',
  'Inman Park',
  'Grant Park',
  'West End',
  'Buckhead',
  'Home Park',
  'Atlantic Station',
  'the BeltLine',
];

const REPORT_ACTIONS = [
  'reported a bike theft near',
  'flagged a cut lock at',
  'reported a stripped frame in',
  'spotted bolt cutters around',
];
const SIGHTING_ACTIONS = [
  'spotted an abandoned bike at',
  'found a dumped bike near',
  'tagged a ditched bike in',
];
const WATCH_ACTIONS = [
  'is now watching',
  'joined the watch in',
  'is keeping an eye on',
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const KIND_META: Record<FeedKind, { color: string; icon: ReactNode }> = {
  report: {
    color: '#ff453a',
    icon: (
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    ),
  },
  sighting: {
    color: '#38bdf8',
    icon: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  recovery: {
    color: '#21d07a',
    icon: <path d="M20 6 9 17l-5-5" />,
  },
  watch: {
    color: 'var(--signal)',
    icon: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
};

const ago = (at: number) => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
};

function seedEvents(): FeedEvent[] {
  const base: { kind: FeedKind; actions: string[] }[] = [
    { kind: 'report', actions: REPORT_ACTIONS },
    { kind: 'sighting', actions: SIGHTING_ACTIONS },
    { kind: 'watch', actions: WATCH_ACTIONS },
    { kind: 'report', actions: REPORT_ACTIONS },
    { kind: 'watch', actions: WATCH_ACTIONS },
    { kind: 'sighting', actions: SIGHTING_ACTIONS },
  ];
  const now = Date.now();
  return base.map((b, i) => ({
    id: `seed-${i}`,
    kind: b.kind,
    handle: COMMUNITY_HANDLES[i % COMMUNITY_HANDLES.length],
    action: pick(b.actions),
    place: pick(PLACES),
    at: now - (i + 1) * 1000 * (45 + Math.floor(Math.random() * 120)),
  }));
}

function ambientEvent(): FeedEvent {
  const roll = Math.random();
  const kind: FeedKind = roll < 0.4 ? 'watch' : roll < 0.72 ? 'report' : 'sighting';
  const actions =
    kind === 'report' ? REPORT_ACTIONS : kind === 'sighting' ? SIGHTING_ACTIONS : WATCH_ACTIONS;
  return {
    id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    handle: pick(COMMUNITY_HANDLES),
    action: pick(actions),
    place: pick(PLACES),
    at: Date.now(),
  };
}

export default function CommunityFeed({ open, onToggle, watchersBase, recovery }: CommunityFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>(() => seedEvents());
  const [watchers, setWatchers] = useState(() => Math.max(28, watchersBase));
  const [, force] = useState(0);

  // Ambient live activity - the community heartbeat.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      setEvents((prev) => [ambientEvent(), ...prev].slice(0, 24));
      setWatchers((w) => Math.max(24, w + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3))));
    }, 4200);
    return () => clearInterval(t);
  }, [open]);

  // Re-render every few seconds so relative timestamps stay fresh.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [open]);

  // A community recovery (sighting matched to a theft) lands at the top.
  const lastRecoveryKey = useRef<number | null>(null);
  useEffect(() => {
    if (!recovery || recovery.key === lastRecoveryKey.current) return;
    lastRecoveryKey.current = recovery.key;
    setEvents((prev) => [
      {
        id: `rec-${recovery.key}`,
        kind: 'recovery' as FeedKind,
        handle: recovery.by,
        action: 'reunited a stolen bike with its owner in',
        place: recovery.place,
        at: Date.now(),
      },
      ...prev,
    ].slice(0, 24));
    setWatchers((w) => w + 2);
  }, [recovery]);

  const watchingNow = useMemo(() => Math.max(watchers, watchersBase), [watchers, watchersBase]);

  return (
    <div className="absolute right-4 top-[84px] z-20 w-[300px] max-w-[88vw]">
      <div className="tac-panel animate-bootIn flex max-h-[440px] flex-col overflow-hidden">
        {/* Header */}
        <button
          onClick={onToggle}
          className="flex items-center justify-between gap-2 border-b border-edge px-3.5 py-3 text-left transition hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-safe shadow-[0_0_6px_#21d07a] animate-livePulse" />
            <span className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-white">
              Community Watch
            </span>
          </div>
          <svg
            className={`text-muted transition-transform ${open ? '' : 'rotate-180'}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <>
            <div className="flex items-center gap-2 border-b border-edge px-3.5 py-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#21d07a" strokeWidth="2">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="mono text-[15px] font-bold leading-none text-safe">{watchingNow}</span>
              <span className="tac-label">riders watching now</span>
            </div>

            <div className="flex flex-col divide-y divide-edge/60 overflow-y-auto">
              {events.map((e) => {
                const meta = KIND_META[e.kind];
                return (
                  <div key={e.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                    <span
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                      style={{ background: `${meta.color}1f`, color: meta.color }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        {meta.icon}
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="text-[12px] text-slate-200">
                        <span className="font-semibold" style={{ color: meta.color }}>
                          {e.handle}
                        </span>{' '}
                        {e.action} {e.place}
                      </div>
                      <div className="mono mt-0.5 text-[9px] uppercase tracking-[0.1em] text-muted">
                        {ago(e.at)} ago
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
