import { useEffect, useState } from 'react';
import type { Incident, IncidentType } from '../lib/types';
import { pickImage, randomHandle } from '../data/incidents';

interface ReportModalProps {
  open: boolean;
  coords: { lat: number; lng: number } | null;
  onClose: () => void;
  onSubmit: (incident: Omit<Incident, 'id' | 'timestamp' | 'isNew'>) => void;
}

const TYPES: { value: IncidentType; label: string; hint: string; accent: string }[] = [
  { value: 'theft', label: 'Theft', hint: 'A bike was stolen', accent: 'var(--theft)' },
  { value: 'suspicious', label: 'Suspicious', hint: 'Sketchy activity', accent: 'var(--signal)' },
  { value: 'sighting', label: 'Sighted bike', hint: 'Spotted stolen / ditched', accent: 'var(--found)' },
];

const DEFAULT_TITLE: Record<IncidentType, string> = {
  theft: 'Bike theft reported',
  suspicious: 'Suspicious activity',
  sighting: 'Sighted stolen bike',
};

export default function ReportModal({ open, coords, onClose, onSubmit }: ReportModalProps) {
  const [type, setType] = useState<IncidentType>('theft');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [handle, setHandle] = useState('');

  useEffect(() => {
    if (open) {
      setType('theft');
      setTitle('');
      setDescription('');
      setHandle('');
    }
  }, [open]);

  if (!open) return null;

  const isSighting = type === 'sighting';
  const accent = TYPES.find((t) => t.value === type)!.accent;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return;
    const reporter = handle.trim()
      ? handle.trim().startsWith('@')
        ? handle.trim()
        : `@${handle.trim()}`
      : randomHandle();
    onSubmit({
      type,
      title: title.trim() || DEFAULT_TITLE[type],
      description:
        description.trim() ||
        (isSighting ? 'Spotted via BikeWatch - keeping an eye out.' : 'Reported via BikeWatch.'),
      lat: coords.lat,
      lng: coords.lng,
      riskWeight: type === 'theft' ? 0.9 : type === 'suspicious' ? 0.55 : 0,
      neighborhood: 'Reported',
      imageUrl: pickImage(title || DEFAULT_TITLE[type], Math.floor(Math.random() * 3)),
      reporter,
      watchers: 1,
    });
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/65 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="tac-panel w-[448px] max-w-[92vw] animate-slideUp p-5 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2.5">
          <div
            className="grid h-8 w-8 place-items-center border"
            style={{ borderColor: accent, color: accent, background: 'rgba(255,255,255,0.04)' }}
          >
            {isSighting ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            )}
          </div>
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-white">
            {isSighting ? 'Report a sighting' : 'Report an incident'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-muted transition hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mono mb-4 text-[10px] uppercase tracking-[0.1em] text-muted">
          {coords ? `Coord ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Click map to set location.'}
        </p>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className="border px-3 py-2 text-left transition"
              style={
                type === t.value
                  ? { borderColor: t.accent, background: 'rgba(255,255,255,0.06)' }
                  : { borderColor: 'var(--line)', background: '#10141f' }
              }
            >
              <div className="text-[13px] font-semibold text-slate-100">{t.label}</div>
              <div className="mono mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted">{t.hint}</div>
            </button>
          ))}
        </div>

        {isSighting && (
          <div
            className="mb-4 border-l-2 px-3 py-2 text-[11px] leading-snug text-slate-300"
            style={{ borderColor: 'var(--found)', background: 'rgba(56,189,248,0.07)' }}
          >
            Spot a bike you think was stolen or ditched? Flag it so the owner can find it - or call APD dispatch straight from the report.
          </div>
        )}

        <label className="tac-label mb-1.5 block">{isSighting ? 'What did you spot?' : 'Title'}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isSighting ? 'e.g. Black road bike by the BeltLine' : 'e.g. Bike stolen outside cafe'}
          className="mb-3 w-full border border-edge bg-panel-2 px-3 py-2 text-[13px] focus:border-brand focus:outline-none"
        />

        <label className="tac-label mb-1.5 block">Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isSighting ? 'Color, condition, where exactly…' : 'What happened?'}
          rows={2}
          className="mb-3 w-full resize-none border border-edge bg-panel-2 px-3 py-2 text-[13px] focus:border-brand focus:outline-none"
        />

        <label className="tac-label mb-1.5 block">Your rider handle</label>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle (optional)"
          className="mono mb-4 w-full border border-edge bg-panel-2 px-3 py-2 text-[12px] focus:border-brand focus:outline-none"
        />

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="mono px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-300 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!coords}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#04121c] transition disabled:opacity-40"
            style={{ background: accent }}
          >
            {isSighting ? 'Post sighting' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  );
}
