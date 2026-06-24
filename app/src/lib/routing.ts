import type { RouteOption, TripEndpoint, TripPlan, Zone } from './types';
import { haversineKm } from './geo';

type LngLat = [number, number];

// Public OSRM demo (keyless, CORS-enabled). Driving profile used as the road
// network - bikes share most streets; ETA is recomputed at cycling speed.
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const BIKE_KMH = 15;
const ZONE_SIGMA = 0.006; // ~660 m influence radius for the zone risk field
const HIGH_NEAR_KM = 0.4; // a route "passes through" a High zone within 400 m
const SCORE_K = 24; // exposure -> safety-score scaling

interface RawRoute {
  coordinates: LngLat[];
  distanceM: number;
  durationS: number;
}

async function osrm(coords: LngLat[], alternatives: boolean): Promise<RawRoute[]> {
  const path = coords.map((c) => `${c[0]},${c[1]}`).join(';');
  const url = `${OSRM}${path}?overview=full&geometries=geojson&alternatives=${
    alternatives ? 'true' : 'false'
  }`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('osrm http');
  const j = await res.json();
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error('osrm no route');
  return j.routes.map((r: { geometry: { coordinates: LngLat[] }; distance: number; duration: number }) => ({
    coordinates: r.geometry.coordinates,
    distanceM: r.distance,
    durationS: r.duration,
  }));
}

function pathKm(coords: LngLat[]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    km += haversineKm(
      { lat: coords[i - 1][1], lng: coords[i - 1][0] },
      { lat: coords[i][1], lng: coords[i][0] },
    );
  }
  return km;
}

/** Mean theft-risk exposure: the model's zone risk field integrated along the
 *  actual street geometry (averaged per vertex so routes are comparable). */
function exposure(coords: LngLat[], zones: Zone[]): number {
  if (!zones.length || !coords.length) return 0;
  const inv = 1 / (2 * ZONE_SIGMA * ZONE_SIGMA);
  let total = 0;
  for (const [lng, lat] of coords) {
    let s = 0;
    for (const z of zones) {
      const dx = lng - z.lng;
      const dy = lat - z.lat;
      s += z.stolenProbability * Math.exp(-(dx * dx + dy * dy) * inv);
    }
    total += s;
  }
  return total / coords.length;
}

/** High-risk zones whose centroid the route passes within HIGH_NEAR_KM of. */
function highZonesCrossed(coords: LngLat[], zones: Zone[]): Zone[] {
  const out: Zone[] = [];
  for (const z of zones) {
    if (z.tier !== 'High') continue;
    for (const c of coords) {
      if (haversineKm({ lat: c[1], lng: c[0] }, z) < HIGH_NEAR_KM) {
        out.push(z);
        break;
      }
    }
  }
  return out;
}

/** A waypoint that detours around the worst High zone blocking the corridor. */
function avoidWaypoint(o: TripEndpoint, d: TripEndpoint, zones: Zone[]): LngLat | null {
  const ux = d.lng - o.lng;
  const uy = d.lat - o.lat;
  const ul = Math.hypot(ux, uy) || 1e-9;
  const un: LngLat = [ux / ul, uy / ul];
  const perp: LngLat = [-un[1], un[0]];

  let obstacle: Zone | null = null;
  for (const z of zones) {
    if (z.tier !== 'High') continue;
    const oz: LngLat = [z.lng - o.lng, z.lat - o.lat];
    const along = oz[0] * un[0] + oz[1] * un[1];
    if (along < 0 || along > ul) continue; // not between origin and dest
    const perpDist = Math.abs(un[0] * oz[1] - un[1] * oz[0]);
    if (perpDist > 0.012) continue; // not near the corridor (~1.3 km)
    if (!obstacle || z.stolenProbability > obstacle.stolenProbability) obstacle = z;
  }
  if (!obstacle) return null;

  const oz: LngLat = [obstacle.lng - o.lng, obstacle.lat - o.lat];
  const along = oz[0] * un[0] + oz[1] * un[1];
  const projPt: LngLat = [o.lng + un[0] * along, o.lat + un[1] * along];
  const cross = un[0] * oz[1] - un[1] * oz[0];
  const sign = cross >= 0 ? -1 : 1; // push to the opposite side of the obstacle
  const offset = 0.014; // ~1.5 km perpendicular detour
  return [projPt[0] + perp[0] * sign * offset, projPt[1] + perp[1] * sign * offset];
}

const etaMin = (km: number) => Math.max(1, Math.round((km / BIKE_KMH) * 60));
const safetyScore = (e: number) => Math.max(5, Math.min(98, Math.round(100 - e * SCORE_K)));

function toOption(
  id: 'safe' | 'fast',
  label: string,
  raw: RawRoute,
  zones: Zone[],
): RouteOption & { _exposure: number; _zones: Zone[] } {
  const km = pathKm(raw.coordinates);
  const e = exposure(raw.coordinates, zones);
  const crossed = highZonesCrossed(raw.coordinates, zones);
  return {
    id,
    kind: id,
    label,
    coordinates: raw.coordinates,
    distanceKm: Math.round(km * 100) / 100,
    etaMin: etaMin(km),
    safetyScore: safetyScore(e),
    riskExposure: Math.round(e * 1000) / 1000,
    highRiskZones: crossed.map((z) => z.label),
    explanation: '',
    _exposure: e,
    _zones: crossed,
  };
}

function straightFallback(o: TripEndpoint, d: TripEndpoint): RawRoute {
  const coords: LngLat[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    coords.push([o.lng + (d.lng - o.lng) * t, o.lat + (d.lat - o.lat) * t]);
  }
  const km = pathKm(coords);
  return { coordinates: coords, distanceM: km * 1000, durationS: (km / BIKE_KMH) * 3600 };
}

export async function planTrip(
  origin: TripEndpoint,
  destination: TripEndpoint,
  zones: Zone[],
): Promise<TripPlan> {
  const o: LngLat = [origin.lng, origin.lat];
  const d: LngLat = [destination.lng, destination.lat];

  let candidates: RawRoute[] = [];
  try {
    const [alts, via] = await Promise.all([
      osrm([o, d], true),
      (async () => {
        const wp = avoidWaypoint(origin, destination, zones);
        return wp ? osrm([o, wp, d], false).catch(() => []) : Promise.resolve([] as RawRoute[]);
      })(),
    ]);
    candidates = [...alts, ...via];
  } catch {
    candidates = [straightFallback(origin, destination)];
  }
  if (!candidates.length) candidates = [straightFallback(origin, destination)];

  // Score every candidate; pick fastest (min time) and safest (min exposure).
  const scored = candidates.map((c) => ({
    raw: c,
    km: pathKm(c.coordinates),
    dur: c.durationS,
    exp: exposure(c.coordinates, zones),
  }));
  const fastRaw = scored.reduce((a, b) => (b.dur < a.dur ? b : a));
  let safeRaw = scored.reduce((a, b) => (b.exp < a.exp ? b : a));
  if (safeRaw.raw === fastRaw.raw) {
    const others = scored.filter((s) => s.raw !== fastRaw.raw);
    if (others.length) safeRaw = others.reduce((a, b) => (b.exp < a.exp ? b : a));
  }

  const fast = toOption('fast', 'Fastest', fastRaw.raw, zones);
  const safe = toOption('safe', 'Safest', safeRaw.raw, zones);

  // Build the defensible explanations.
  const reduction =
    fast._exposure > 0 ? Math.max(0, (fast._exposure - safe._exposure) / fast._exposure) : 0;
  const reductionPct = Math.round(reduction * 100);
  const dMin = safe.etaMin - fast.etaMin;
  const dKm = Math.round((safe.distanceKm - fast.distanceKm) * 10) / 10;

  fast.explanation = fast.highRiskZones.length
    ? `Quickest route, but it passes through ${joinZones(fast._zones)} - ${
        fast.highRiskZones.length
      } high-theft ${fast.highRiskZones.length === 1 ? 'zone' : 'zones'}.`
    : 'Quickest route, and it already stays clear of the top theft zones.';

  if (safe.coordinates === fast.coordinates) {
    safe.explanation = 'The fastest route is already the lowest-risk path available.';
  } else if (reductionPct >= 3) {
    const avoided = fast._zones.filter((z) => !safe.highRiskZones.includes(z.label));
    safe.explanation =
      `${reductionPct}% less modeled theft exposure than the fastest route` +
      (avoided.length ? `, routing around ${joinZones(avoided)}` : '') +
      `${dMin > 0 ? ` (+${dMin} min, +${Math.max(0, dKm)} km)` : ''}.`;
  } else {
    safe.explanation = 'Marginally safer than the fastest route on these streets.';
  }

  delete (safe as Partial<typeof safe>)._exposure;
  delete (safe as Partial<typeof safe>)._zones;
  delete (fast as Partial<typeof fast>)._exposure;
  delete (fast as Partial<typeof fast>)._zones;

  return {
    origin,
    destination,
    options: [safe, fast],
    selectedId: 'safe',
    riskReductionPct: reductionPct,
  };
}

function joinZones(zones: Zone[]): string {
  const names = zones
    .slice()
    .sort((a, b) => b.stolenProbability - a.stolenProbability)
    .slice(0, 3)
    .map((z) => `${z.label} (${Math.round(z.stolenProbability * 100)}%)`);
  if (names.length <= 1) return names[0] ?? 'a high-risk area';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
