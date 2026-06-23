import type { Incident, SafeZone } from './types';

const R = 6371; // km
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Hotspot {
  lat: number;
  lng: number;
  label: string;
  score: number;
  count: number;
}

export type RiskTier = 'High' | 'Medium' | 'Low';

export interface ZoneStat extends Hotspot {
  theftCount: number;
  avg: number;
  tier: RiskTier;
}

const tierFor = (avg: number): RiskTier =>
  avg >= 0.7 ? 'High' : avg >= 0.45 ? 'Medium' : 'Low';

/** Group incidents into hotspots by neighborhood, weighted by recency + riskWeight. */
export function computeHotspots(incidents: Incident[]): Hotspot[] {
  const groups = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const key = inc.neighborhood ?? 'Other';
    const arr = groups.get(key) ?? [];
    arr.push(inc);
    groups.set(key, arr);
  }
  const hotspots: Hotspot[] = [];
  groups.forEach((arr, label) => {
    const lat = arr.reduce((s, i) => s + i.lat, 0) / arr.length;
    const lng = arr.reduce((s, i) => s + i.lng, 0) / arr.length;
    const score = arr.reduce((s, i) => s + i.riskWeight, 0);
    hotspots.push({ lat, lng, label, score, count: arr.length });
  });
  return hotspots.sort((a, b) => b.score - a.score);
}

/** Per-zone analytics for the heatmap overlay: counts, theft share, risk tier. */
export function computeZoneStats(incidents: Incident[], minCount = 2): ZoneStat[] {
  const groups = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const key = inc.neighborhood ?? 'Other';
    const arr = groups.get(key) ?? [];
    arr.push(inc);
    groups.set(key, arr);
  }
  const zones: ZoneStat[] = [];
  groups.forEach((arr, label) => {
    if (arr.length < minCount) return;
    const lat = arr.reduce((s, i) => s + i.lat, 0) / arr.length;
    const lng = arr.reduce((s, i) => s + i.lng, 0) / arr.length;
    const score = arr.reduce((s, i) => s + i.riskWeight, 0);
    const avg = score / arr.length;
    const theftCount = arr.filter((i) => i.type === 'theft').length;
    zones.push({ lat, lng, label, score, count: arr.length, theftCount, avg, tier: tierFor(avg) });
  });
  return zones.sort((a, b) => b.score - a.score);
}

export function nearestSafeZone(
  origin: { lat: number; lng: number },
  zones: SafeZone[],
): SafeZone {
  return [...zones].sort(
    (a, b) => haversineKm(origin, a) - haversineKm(origin, b),
  )[0];
}
