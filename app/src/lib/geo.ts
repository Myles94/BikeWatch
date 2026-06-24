import type { HeatPoint, Incident, SafeZone, Zone } from './types';

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
  stolenProbability: number; // 0..1 — predicted likelihood an unattended bike is stolen
}

const tierFor = (avg: number): RiskTier =>
  avg >= 0.7 ? 'High' : avg >= 0.45 ? 'Medium' : 'Low';

/** Pseudo-model output: predicted theft probability from risk + incident density. */
const stolenProbabilityFor = (avg: number, count: number): number =>
  Math.min(0.97, Math.max(0.05, 0.32 + 0.46 * avg + 0.028 * count));

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
    zones.push({
      lat,
      lng,
      label,
      score,
      count: arr.length,
      theftCount,
      avg,
      tier: tierFor(avg),
      stolenProbability: stolenProbabilityFor(avg, arr.length),
    });
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

// A tight ring (in degrees) used to bloom a single report into a readable blob.
const REPORT_RING: ReadonlyArray<readonly [number, number]> = [
  [0.0007, 0],
  [-0.0007, 0],
  [0, 0.0008],
  [0, -0.0008],
  [0.0005, 0.0006],
  [-0.0005, -0.0006],
];

/**
 * Turns incident markers (curated FEATURED_REPORTS + user reports) into KDE
 * heat-points so every dot sits inside a real hotspot blob and a freshly
 * reported pin visibly intensifies the heatmap. APD markers are skipped — they
 * already ARE heat-points emitted by the pipeline, so re-adding them would
 * double-count. Each report blooms into a center point plus a soft ring so a
 * lone report still reads as a rounded hotspot rather than a faint speck.
 */
export function reportHeatPoints(incidents: Incident[]): HeatPoint[] {
  const out: HeatPoint[] = [];
  for (const inc of incidents) {
    // APD markers are already pipeline heat-points; found-bike sightings and
    // already-recovered thefts are not live theft risk, so none add heat.
    if (inc.source === 'apd' || inc.type === 'sighting' || inc.recovered) continue;
    const w = inc.isNew ? 1 : Math.max(0.55, inc.riskWeight);
    out.push({ lat: inc.lat, lng: inc.lng, w });
    for (const [dLat, dLng] of REPORT_RING) {
      out.push({ lat: inc.lat + dLat, lng: inc.lng + dLng, w: w * 0.6 });
    }
  }
  return out;
}

// ~1.3 km cap so a card can never fly outside its own neighborhood.
const MAX_ANCHOR_SHIFT_DEG = 0.012;

/**
 * Re-anchors each zone to the weighted centroid of the heat-points nearest it —
 * i.e. the bright core of its heatmap blob — instead of the plain geographic
 * mean of incidents. This keeps zone-analytics cards (and copilot fly-to
 * targets) pinned to the actual hotspot rather than drifting off to one side.
 * The shift is clamped so sparse/edge zones never jump to a neighbor's blob.
 */
export function anchorZonesToHotspots(zones: Zone[], heatPoints: HeatPoint[]): Zone[] {
  if (zones.length === 0 || heatPoints.length === 0) return zones;
  const acc = zones.map(() => ({ w: 0, lat: 0, lng: 0 }));
  for (const p of heatPoints) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < zones.length; i++) {
      const dLat = p.lat - zones[i].lat;
      const dLng = p.lng - zones[i].lng;
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const w = p.w > 0 ? p.w : 0.001;
    acc[best].w += w;
    acc[best].lat += w * p.lat;
    acc[best].lng += w * p.lng;
  }
  return zones.map((z, i) => {
    const a = acc[i];
    if (a.w <= 0) return z;
    const lat = a.lat / a.w;
    const lng = a.lng / a.w;
    const dLat = lat - z.lat;
    const dLng = lng - z.lng;
    if (dLat * dLat + dLng * dLng > MAX_ANCHOR_SHIFT_DEG * MAX_ANCHOR_SHIFT_DEG) return z;
    return { ...z, lat, lng };
  });
}
