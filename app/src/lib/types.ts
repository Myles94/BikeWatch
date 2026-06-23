export type IncidentType = 'theft' | 'suspicious';

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  timestamp: string; // ISO
  riskWeight: number; // 0..1
  neighborhood?: string;
  imageUrl?: string;
  isNew?: boolean;
}

export interface SafeZone {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  rationale: string;
}

export type RecommendationKind = 'route' | 'parking' | 'avoid';

export interface CopilotRecommendation {
  kind: RecommendationKind;
  routeId?: string;
  safeZoneId?: string;
  avoidHotspot?: { lat: number; lng: number; label: string };
}

export interface CopilotResult {
  question: string;
  answer: string;
  bullets: string[];
  recommendation?: CopilotRecommendation;
}

export interface SafeRoute {
  id: string;
  title: string;
  description: string;
  coordinates: [number, number][]; // [lng, lat]
}
