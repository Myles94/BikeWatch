import type {
  CopilotResult,
  Incident,
  SafeRoute,
  SafeZone,
} from './types';
import { computeHotspots, haversineKm, nearestSafeZone } from './geo';

export interface CopilotContext {
  origin: { lat: number; lng: number; label: string };
  incidents: Incident[];
  safeZones: SafeZone[];
  routes: SafeRoute[];
}

export const SUGGESTED_PROMPTS = [
  'Where is it safer to park nearby?',
  'What areas should I avoid?',
  "What's the safest route home?",
  'Is it risky to lock up here right now?',
];

type Intent = 'park' | 'avoid' | 'route' | 'risk' | 'unknown';

function classify(question: string): Intent {
  const q = question.toLowerCase();
  if (/(route|ride|home|get to|cycle|commute)/.test(q)) return 'route';
  if (/(park|lock|leave my bike|secure|store|rack)/.test(q)) {
    if (/(risk|safe to|dangerous|here)/.test(q) && !/where|nearby|better/.test(q))
      return 'risk';
    return 'park';
  }
  if (/(avoid|danger|risky|unsafe|hotspot|bad area)/.test(q)) return 'avoid';
  if (/(risk|safe|dangerous)/.test(q)) return 'risk';
  return 'unknown';
}

const fmtKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export function runCopilot(
  question: string,
  ctx: CopilotContext,
): CopilotResult {
  const intent = classify(question);
  const hotspots = computeHotspots(ctx.incidents);
  const topHotspots = hotspots.slice(0, 3);
  const worst = topHotspots[0];

  switch (intent) {
    case 'park': {
      const zone = nearestSafeZone(ctx.origin, ctx.safeZones);
      const dist = haversineKm(ctx.origin, zone);
      return {
        question,
        answer: `The safest nearby place to lock up is the ${zone.title}, about ${fmtKm(
          dist,
        )} away. ${zone.rationale}`,
        bullets: [
          `Head to ${zone.title} — ${zone.description.toLowerCase()}`,
          `Avoid street racks near ${worst.label}, the current #1 theft hotspot (${worst.count} recent reports).`,
          'Use a hardened U-lock through the frame and rear wheel.',
        ],
        recommendation: { kind: 'parking', safeZoneId: zone.id },
      };
    }
    case 'route': {
      const route = ctx.routes[0];
      return {
        question,
        answer: `I mapped a safer route home that stays on protected paths and avoids the ${topHotspots
          .map((h) => h.label)
          .slice(0, 2)
          .join(' and ')} hotspots.`,
        bullets: [
          `Follow the ${route.title} — ${route.description.toLowerCase()}`,
          `It detours around ${worst.label}, where ${worst.count} thefts were reported recently.`,
          'Well-lit, higher-traffic segments reduce snatch-and-grab risk.',
        ],
        recommendation: { kind: 'route', routeId: route.id },
      };
    }
    case 'avoid': {
      return {
        question,
        answer: `Right now the highest-risk areas are ${topHotspots
          .map((h) => h.label)
          .join(', ')}. I'd avoid leaving a bike unattended in these zones.`,
        bullets: topHotspots.map(
          (h) =>
            `${h.label}: ${h.count} recent reports, risk score ${h.score.toFixed(
              1,
            )}.`,
        ),
        recommendation: worst
          ? {
              kind: 'avoid',
              avoidHotspot: { lat: worst.lat, lng: worst.lng, label: worst.label },
            }
          : undefined,
      };
    }
    case 'risk': {
      // Risk at the current origin location
      const nearby = ctx.incidents
        .map((i) => ({ i, d: haversineKm(ctx.origin, i) }))
        .filter((x) => x.d < 0.6)
        .sort((a, b) => a.d - b.d);
      const high = nearby.length >= 3;
      const zone = nearestSafeZone(ctx.origin, ctx.safeZones);
      return {
        question,
        answer: high
          ? `Yes — this spot is risky. There are ${nearby.length} theft reports within 600 m of ${ctx.origin.label}. Consider the ${zone.title} instead.`
          : `This area looks relatively low-risk right now, but stay cautious near ${worst.label}.`,
        bullets: high
          ? [
              `${nearby.length} incidents within 600 m, closest just ${fmtKm(
                nearby[0].d,
              )} away.`,
              `Safer alternative: ${zone.title} (${zone.rationale.toLowerCase()})`,
              'If you must lock here, pick a busy, well-lit rack and use two locks.',
            ]
          : [
              'Few recent reports in your immediate area.',
              'Still use a U-lock and avoid isolated racks.',
              `Closest hotspot is ${worst.label}.`,
            ],
        recommendation: high
          ? { kind: 'parking', safeZoneId: zone.id }
          : undefined,
      };
    }
    default: {
      return {
        question,
        answer: `I'm your biking safety copilot. I can flag theft hotspots, find safer parking, and route you around danger. Right now ${worst.label} is the #1 hotspot.`,
        bullets: SUGGESTED_PROMPTS.map((p) => `Try: "${p}"`),
      };
    }
  }
}
