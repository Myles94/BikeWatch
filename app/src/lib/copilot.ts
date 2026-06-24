import type {
  CopilotResult,
  Incident,
  RiskModel,
  SafeRoute,
  SafeZone,
  Temporal,
  Zone,
} from './types';
import { haversineKm, nearestSafeZone } from './geo';
import { type TimeSel, formatHour, globalMultiplier } from './temporal';

export interface CopilotContext {
  origin: { lat: number; lng: number; label: string };
  incidents: Incident[];
  safeZones: SafeZone[];
  routes: SafeRoute[];
  zones: Zone[];
  model: RiskModel | null;
  temporal: Temporal | null;
  time: TimeSel;
}

export const SUGGESTED_PROMPTS = [
  'Is my area safe right now?',
  'Where should I park?',
  'Riskiest areas right now?',
  'Where was the last theft?',
];

type Intent =
  | 'park'
  | 'avoid'
  | 'route'
  | 'risk'
  | 'areanow'
  | 'accuracy'
  | 'riskiest'
  | 'recent'
  | 'timeofday'
  | 'unknown';

function classify(q: string): Intent {
  const s = q.toLowerCase();
  const hasNow = /(right now|tonight|currently|at the moment|this hour|\bnow\b|today)/.test(s);
  if (/(accurate|accuracy|validat|how good|reliable|trust|real data|how does|model work|prove)/.test(s))
    return 'accuracy';
  if (/(last|latest|recent|most recent|where was|when was)/.test(s)) return 'recent';
  if (/(route|ride|get to|cycle|commute|cycling|bike home|way home)/.test(s)) return 'route';
  // Locality + a time word ("is my area safe right now?") - checked before park
  // so "block" can't be swallowed by the park/"lock" keyword.
  if (
    hasNow &&
    /(my area|near me|around me|\bhere\b|my block|my location|this area|where i am|safe right now|safe now|is it safe)/.test(s)
  )
    return 'areanow';
  if (/(park|lock|leave my bike|secure|store|rack)/.test(s)) {
    if (/(risk|safe to|dangerous|here)/.test(s) && !/where|nearby|better/.test(s)) return 'risk';
    return 'park';
  }
  if (/(riskiest|worst|most dangerous|highest risk|top (zones|areas|spots)|hotspot)/.test(s))
    return 'riskiest';
  if (/(avoid|danger|unsafe|bad area)/.test(s)) return 'avoid';
  if (/(right now|tonight|this time|at night|currently|now|time of day|when is)/.test(s))
    return 'timeofday';
  if (/(risk|safe|dangerous|my area)/.test(s)) return 'risk';
  return 'unknown';
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const pct = (p: number) => `${Math.round(p * 100)}%`;

const RECENT_WINDOW_H = 48;
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600_000;

/** Live activity rollup across the current incident feed. */
function liveCounts(ctx: CopilotContext) {
  let recent = 0;
  let thefts = 0;
  let suspicious = 0;
  let sightings = 0;
  for (const i of ctx.incidents) {
    if (i.type === 'theft') thefts += 1;
    else if (i.type === 'suspicious') suspicious += 1;
    else if (i.type === 'sighting') sightings += 1;
    if (i.timestamp && hoursSince(i.timestamp) <= RECENT_WINDOW_H) recent += 1;
  }
  return { total: ctx.incidents.length, recent, thefts, suspicious, sightings };
}

/**
 * Community layer rolled up from real incident fields - found-bike sightings and
 * rider-matched recoveries - so the copilot cites actual data, never fabricated.
 */
function communitySignal(ctx: CopilotContext): { sightings: number; recovered: number } {
  const sightings = ctx.incidents.filter((i) => i.type === 'sighting').length;
  const recovered = ctx.incidents.filter((i) => i.recovered).length;
  return { sightings, recovered };
}

const hoodSuspicious = (ctx: CopilotContext, hood: string): number =>
  ctx.incidents.filter((i) => i.type === 'suspicious' && (i.neighborhood ?? '') === hood).length;

function nearestZone(ctx: CopilotContext): Zone | null {
  if (!ctx.zones.length) return null;
  return [...ctx.zones].sort(
    (a, b) => haversineKm(ctx.origin, a) - haversineKm(ctx.origin, b),
  )[0];
}

function whenLabel(ctx: CopilotContext): string {
  return `${ctx.time.dayType} ${formatHour(ctx.time.hour)}`;
}

function timeTrend(ctx: CopilotContext): { pct: number; phrase: string } {
  const m = globalMultiplier(ctx.temporal, ctx.time);
  const p = Math.round((m - 1) * 100);
  const phrase =
    p > 12 ? `elevated (+${p}% vs the daily average)` : p < -12 ? `below average (${p}%)` : 'about average';
  return { pct: p, phrase };
}

/** Zones ranked by their activity multiplier at the selected time. */
function peakingNow(ctx: CopilotContext): { zone: Zone; mult: number }[] {
  if (!ctx.temporal) return [];
  const key = ctx.time.dayType === 'weekend' ? 'we' : 'wd';
  return ctx.zones
    .map((z) => {
      const prof = ctx.temporal!.zones[z.label];
      const mult = prof ? prof[key][ctx.time.hour] ?? 1 : 1;
      return { zone: z, mult };
    })
    .sort((a, b) => b.mult - a.mult);
}

export function runCopilot(question: string, ctx: CopilotContext): CopilotResult {
  const intent = classify(question);
  const top = ctx.zones.slice(0, 3);
  const worst = top[0] ?? null;
  const when = whenLabel(ctx);

  switch (intent) {
    case 'accuracy': {
      const v = ctx.model?.validation;
      if (!v || !ctx.model) {
        return {
          question,
          answer: "I'm scoring risk from a model trained on real Atlanta PD theft data.",
          bullets: ['Live data is still loading - ask again in a moment.'],
        };
      }
      return {
        question,
        answer: `This isn't a guess - it's a model trained on ${ctx.model.nIncidents.toLocaleString()} real Atlanta PD larceny reports (${ctx.model.window}). On a held-out test, its top 5% of hotspots caught ${pct(
          v.topHotspotCapture,
        )} of the thefts that happened next - ${v.pai}× better than chance.`,
        bullets: [
          `Trained on ${v.trainN.toLocaleString()} incidents through ${v.trainEnd}, tested on the ${v.testN.toLocaleString()} that came after.`,
          `Capture curve: top 2% → ${pct(v.captureCurve['2%'])}, 10% → ${pct(
            v.captureCurve['10%'],
          )}, 20% → ${pct(v.captureCurve['20%'])} of future thefts.`,
          `Method: ${ctx.model.method}. Bicycle theft has no police category, so "All Other Larceny" is used as a documented proxy.`,
        ],
      };
    }

    case 'riskiest': {
      if (!top.length) break;
      return {
        question,
        answer: `The highest-risk areas right now are ${top
          .map((z) => `${z.label} (${pct(z.stolenProbability)})`)
          .join(', ')} - all modeled from real APD report density.`,
        bullets: top.map(
          (z) => `${z.label}: ${pct(z.stolenProbability)} predicted theft odds · ${z.count} reports · ${z.tier} risk.`,
        ),
        recommendation: worst
          ? { kind: 'avoid', avoidHotspot: { lat: worst.lat, lng: worst.lng, label: worst.label } }
          : undefined,
      };
    }

    case 'recent': {
      const wantTheft = /(theft|stolen|stole|robbed|bike)/.test(question.toLowerCase());
      const pool = wantTheft ? ctx.incidents.filter((i) => i.type === 'theft') : ctx.incidents;
      const source = pool.length ? pool : ctx.incidents;
      const recentList = [...source]
        .filter((i) => i.timestamp)
        .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
        .slice(0, 3);
      if (!recentList.length) break;
      const last = recentList[0];
      const live = liveCounts(ctx);
      const sig = communitySignal(ctx);
      const zone = ctx.zones.find((z) => z.label === last.neighborhood) ?? null;
      return {
        question,
        answer: `The most recent report was "${last.title}" in ${last.neighborhood ?? 'Atlanta'} ${ago(
          last.timestamp,
        )}${zone ? ` - a ${zone.tier}-risk area (${pct(zone.stolenProbability)} modeled theft odds)` : ''}.`,
        bullets: [
          ...recentList.map(
            (i) => `${i.neighborhood ?? 'Atlanta'}: ${i.title.toLowerCase()} · ${ago(i.timestamp)}.`,
          ),
          `${live.recent} reports in the last ${RECENT_WINDOW_H}h · ${sig.sightings} community sightings · ${sig.recovered} bikes recovered via rider matches.`,
        ],
        recommendation: zone
          ? { kind: 'avoid', avoidHotspot: { lat: zone.lat, lng: zone.lng, label: zone.label } }
          : undefined,
      };
    }

    case 'timeofday': {
      const trend = timeTrend(ctx);
      const peaks = peakingNow(ctx).slice(0, 3);
      return {
        question,
        answer: `At ${when}, citywide theft risk is ${trend.phrase}.${
          peaks.length ? ` Right now ${peaks[0].zone.label} is the most active hotspot.` : ''
        }`,
        bullets: peaks.length
          ? peaks.map(
              (p) =>
                `${p.zone.label}: ${
                  p.mult >= 1 ? `${Math.round((p.mult - 1) * 100)}% above` : `${Math.round((1 - p.mult) * 100)}% below`
                } its average activity at this hour.`,
            )
          : ['Toggle the heatmap and scrub the time slider to see risk shift by hour.'],
        recommendation: peaks[0]
          ? { kind: 'avoid', avoidHotspot: { lat: peaks[0].zone.lat, lng: peaks[0].zone.lng, label: peaks[0].zone.label } }
          : undefined,
      };
    }

    case 'areanow': {
      const zone = nearestZone(ctx);
      if (!zone) break;
      const safe = nearestSafeZone(ctx.origin, ctx.safeZones);
      const trend = timeTrend(ctx);
      const live = liveCounts(ctx);
      const peak = peakingNow(ctx).find((p) => p.zone.label === zone.label);
      const mult = peak ? peak.mult : 1;
      const localPhrase =
        mult >= 1.12
          ? `running ${Math.round((mult - 1) * 100)}% above its usual activity this hour`
          : mult <= 0.88
            ? `quieter than its usual ${formatHour(ctx.time.hour)} level`
            : 'near its typical level for this hour';
      const suspicious = hoodSuspicious(ctx, zone.label);
      const high = zone.tier === 'High';
      return {
        question,
        answer: `Right now (${when}) you're in ${zone.label}: ${pct(
          zone.stolenProbability,
        )} modeled theft odds (${zone.tier} risk). City-wide theft risk is ${trend.phrase}, and ${zone.label} is ${localPhrase}.`,
        bullets: [
          `${live.recent} reports city-wide in the last ${RECENT_WINDOW_H}h${
            suspicious ? ` · ${suspicious} suspicious report${suspicious > 1 ? 's' : ''} near ${zone.label}` : ''
          }.`,
          high
            ? `${zone.label} is one of the city's worst zones - don't leave a bike here right now.`
            : `${zone.label} is moderate right now - still lock to a busy, lit rack.`,
          `Safest nearby: ${safe.title}, ${fmtKm(haversineKm(ctx.origin, safe))} away.`,
        ],
        recommendation: high
          ? { kind: 'avoid', avoidHotspot: { lat: zone.lat, lng: zone.lng, label: zone.label } }
          : { kind: 'parking', safeZoneId: safe.id },
      };
    }

    case 'park': {
      const zone = nearestSafeZone(ctx.origin, ctx.safeZones);
      const dist = haversineKm(ctx.origin, zone);
      const hot = nearestZone(ctx) ?? worst;
      return {
        question,
        answer: `Safest nearby parking is the ${zone.title}, about ${fmtKm(dist)} away. ${zone.rationale}`,
        bullets: [
          `Head to ${zone.title} - ${zone.description.toLowerCase()}`,
          hot
            ? `Avoid street racks around ${hot.label} (${pct(hot.stolenProbability)} modeled theft odds, ${hot.count} reports).`
            : 'Avoid isolated, unlit racks.',
          'Use a hardened U-lock through the frame and rear wheel.',
        ],
        recommendation: { kind: 'parking', safeZoneId: zone.id },
      };
    }

    case 'route': {
      const route = ctx.routes[0];
      return {
        question,
        answer: `I mapped a safer route that stays on protected paths and avoids the ${top
          .slice(0, 2)
          .map((z) => z.label)
          .join(' and ')} hotspots.`,
        bullets: [
          `Follow the ${route.title} - ${route.description.toLowerCase()}`,
          worst ? `It detours around ${worst.label} (${pct(worst.stolenProbability)} theft odds).` : 'It favors lit, higher-traffic streets.',
          'Open the Route planner for a full safest-vs-direct comparison with safety scores.',
        ],
        recommendation: { kind: 'route', routeId: route.id },
      };
    }

    case 'avoid': {
      if (!top.length) break;
      return {
        question,
        answer: `Avoid leaving a bike unattended in ${top.map((z) => z.label).join(', ')} - the model's top theft zones from real APD data.`,
        bullets: top.map((z) => `${z.label}: ${pct(z.stolenProbability)} theft odds · ${z.count} reports · ${z.tier} risk.`),
        recommendation: worst
          ? { kind: 'avoid', avoidHotspot: { lat: worst.lat, lng: worst.lng, label: worst.label } }
          : undefined,
      };
    }

    case 'risk': {
      const zone = nearestZone(ctx);
      const safe = nearestSafeZone(ctx.origin, ctx.safeZones);
      const trend = timeTrend(ctx);
      if (!zone) break;
      const high = zone.tier === 'High';
      const live = liveCounts(ctx);
      const suspicious = hoodSuspicious(ctx, zone.label);
      return {
        question,
        answer: `Your area maps to ${zone.label}: ${pct(zone.stolenProbability)} modeled theft odds (${zone.tier} risk, ${zone.count} reports). At ${when}, citywide risk is ${trend.phrase}.`,
        bullets: [
          high
            ? `${zone.label} is among the city's worst - don't leave a bike here unattended.`
            : `${zone.label} is moderate, but stay cautious near busier blocks.`,
          `${live.recent} reports city-wide in the last ${RECENT_WINDOW_H}h${
            suspicious ? ` · ${suspicious} suspicious report${suspicious > 1 ? 's' : ''} near ${zone.label}` : ''
          }.`,
          `Safer alternative: ${safe.title} (${fmtKm(haversineKm(ctx.origin, safe))} away).`,
          'Use two locks and pick a lit, high-traffic rack.',
        ],
        recommendation: high ? { kind: 'parking', safeZoneId: safe.id } : undefined,
      };
    }
  }

  // Fallback / unknown
  const v = ctx.model?.validation;
  const live = liveCounts(ctx);
  const sig = communitySignal(ctx);
  return {
    question,
    answer: worst
      ? `I'm your theft-intelligence copilot, scoring risk from ${ctx.model?.nIncidents.toLocaleString() ?? 'real'} Atlanta PD reports. ${live.recent} came in the last ${RECENT_WINDOW_H}h; right now ${worst.label} is the #1 risk zone (${pct(
          worst.stolenProbability,
        )}).`
      : "I'm your theft-intelligence copilot. Ask me where to park, what to avoid, or how the model works.",
    bullets: v
      ? [
          `${sig.sightings} community bike sightings · ${sig.recovered} recovered via rider matches.`,
          `Model validated at ${v.pai}× better than chance on held-out data.`,
          ...SUGGESTED_PROMPTS.map((p) => `Try: "${p}"`),
        ]
      : SUGGESTED_PROMPTS.map((p) => `Try: "${p}"`),
  };
}

function ago(iso: string): string {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'in the last hour';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
