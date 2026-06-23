import type { Incident, RouteOption, TripEndpoint, TripPlan } from './types';
import { computeHotspots, haversineKm } from './geo';

type LngLat = [number, number];

// Influence radius (degrees, ~0.0055 deg lat ≈ 610 m) used for both the
// repulsion field that bends the safe path and the risk-exposure score.
const SIGMA = 0.0055;
const NODES = 28;
const SCALE = 120; // exposure -> safety score scaling
const BIKE_KMH = 15;

function straightPath(o: TripEndpoint, d: TripEndpoint, n = NODES): LngLat[] {
  const pts: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([o.lng + (d.lng - o.lng) * t, o.lat + (d.lat - o.lat) * t]);
  }
  return pts;
}

/**
 * Bends a straight path away from incident clusters using a gaussian repulsion
 * field, then smooths it. Endpoints stay fixed. This is a lightweight stand-in
 * for a real risk-weighted routing graph — good enough to visualize the idea.
 */
function avoidPath(direct: LngLat[], incidents: Incident[]): LngLat[] {
  let pts: LngLat[] = direct.map((p, idx) => {
    if (idx === 0 || idx === direct.length - 1) return [p[0], p[1]];
    let fx = 0;
    let fy = 0;
    for (const inc of incidents) {
      const dx = p[0] - inc.lng;
      const dy = p[1] - inc.lat;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) || 1e-6;
      const w = inc.riskWeight * Math.exp(-d2 / (2 * SIGMA * SIGMA));
      fx += (dx / d) * w;
      fy += (dy / d) * w;
    }
    const mag = Math.hypot(fx, fy);
    if (mag < 1e-6) return [p[0], p[1]];
    const off = Math.min(0.014, mag * 0.009);
    return [p[0] + (fx / mag) * off, p[1] + (fy / mag) * off];
  });

  // Smoothing passes (keep endpoints fixed)
  for (let s = 0; s < 4; s++) {
    pts = pts.map((p, i) =>
      i === 0 || i === pts.length - 1
        ? p
        : [
            (pts[i - 1][0] + p[0] + pts[i + 1][0]) / 3,
            (pts[i - 1][1] + p[1] + pts[i + 1][1]) / 3,
          ],
    );
  }
  return pts;
}

function pathDistanceKm(path: LngLat[]): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    km += haversineKm(
      { lat: path[i - 1][1], lng: path[i - 1][0] },
      { lat: path[i][1], lng: path[i][0] },
    );
  }
  return km;
}

/** Mean gaussian incident exposure sampled along the path. */
function exposure(path: LngLat[], incidents: Incident[]): number {
  let e = 0;
  for (const [lng, lat] of path) {
    for (const inc of incidents) {
      const dx = lng - inc.lng;
      const dy = lat - inc.lat;
      const d2 = dx * dx + dy * dy;
      e += inc.riskWeight * Math.exp(-d2 / (2 * SIGMA * SIGMA));
    }
  }
  return e / path.length;
}

function hotspotsPassed(path: LngLat[], incidents: Incident[]): number {
  const hs = computeHotspots(incidents).filter((h) => h.score >= 1.5);
  let n = 0;
  for (const h of hs) {
    let min = Infinity;
    for (const [lng, lat] of path) {
      min = Math.min(min, Math.hypot(lng - h.lng, lat - h.lat));
    }
    if (min < 0.0028) n++; // within ~310 m of the path
  }
  return n;
}

const scoreOf = (exp: number) =>
  Math.max(3, Math.min(99, Math.round(100 - exp * SCALE)));
const etaOf = (km: number) => Math.max(1, Math.round((km / BIKE_KMH) * 60));

function optionFrom(
  id: 'safe' | 'direct',
  label: string,
  coords: LngLat[],
  incidents: Incident[],
): RouteOption {
  const distanceKm = pathDistanceKm(coords);
  return {
    id,
    kind: id,
    label,
    coordinates: coords,
    distanceKm,
    etaMin: etaOf(distanceKm),
    safetyScore: scoreOf(exposure(coords, incidents)),
    hotspotsPassed: hotspotsPassed(coords, incidents),
  };
}

export function planTrip(
  origin: TripEndpoint,
  destination: TripEndpoint,
  incidents: Incident[],
): TripPlan {
  const directPts = straightPath(origin, destination);
  const safePts = avoidPath(directPts, incidents);
  const direct = optionFrom('direct', 'Direct', directPts, incidents);
  const safe = optionFrom('safe', 'Safest', safePts, incidents);
  return { origin, destination, options: [safe, direct], selectedId: 'safe' };
}
