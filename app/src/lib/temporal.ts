import type { HeatPoint, Temporal } from './types';

export type DayType = 'weekday' | 'weekend';

export interface TimeSel {
  dayType: DayType;
  hour: number; // 0..23
}

export function nowSelection(): TimeSel {
  const d = new Date();
  const we = d.getDay() === 0 || d.getDay() === 6;
  return { dayType: we ? 'weekend' : 'weekday', hour: d.getHours() };
}

export const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function dayPart(h: number): string {
  if (h < 6) return 'overnight';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * Re-weights the static KDE risk points by each zone's learned hour-of-day
 * activity profile, so the heatmap shifts with the selected time. The profile
 * multipliers have mean 1, so overall density is preserved while hotspots
 * intensify or fade at different times.
 */
export function weightedHeatPoints(
  points: HeatPoint[],
  temporal: Temporal | null,
  sel: TimeSel,
): HeatPoint[] {
  if (!temporal || points.length === 0) return points;
  const key = sel.dayType === 'weekend' ? 'we' : 'wd';
  const globalProfile = temporal.global[key];
  return points.map((p) => {
    let profile = globalProfile;
    if (p.z != null && p.z >= 0) {
      const name = temporal.zoneNames[p.z];
      const zp = name ? temporal.zones[name] : undefined;
      if (zp) profile = zp[key];
    }
    const m = profile[sel.hour] ?? 1;
    return { ...p, w: Math.min(1.3, p.w * m) };
  });
}

/** Relative city-wide risk multiplier at a given time (for copy/labels). */
export function globalMultiplier(temporal: Temporal | null, sel: TimeSel): number {
  if (!temporal) return 1;
  const key = sel.dayType === 'weekend' ? 'we' : 'wd';
  return temporal.global[key][sel.hour] ?? 1;
}
