import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Incident, SafeRoute, SafeZone, TripPlan } from '../lib/types';
import { CITY } from '../data/incidents';
import { DARK_STYLE } from '../lib/mapStyle';
import { computeZoneStats } from '../lib/geo';

interface MapViewProps {
  incidents: Incident[];
  safeZones: SafeZone[];
  activeRoute: SafeRoute | null;
  highlightZoneId: string | null;
  avoidHotspot: { lat: number; lng: number; label: string } | null;
  showHeatmap: boolean;
  trip: TripPlan | null;
  onMapClick: (lng: number, lat: number) => void;
  onReady: () => void;
}

function incidentFeatureCollection(incidents: Incident[]) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents.map((i) => ({
      type: 'Feature' as const,
      properties: { weight: i.riskWeight, type: i.type },
      geometry: { type: 'Point' as const, coordinates: [i.lng, i.lat] },
    })),
  };
}

const timeAgo = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const MONO = "'JetBrains Mono',ui-monospace,monospace";

function popupHtml(inc: Incident) {
  const isTheft = inc.type === 'theft';
  const accent = isTheft ? '#ff453a' : '#ffb000';
  const tagText = isTheft ? 'THEFT' : 'SUSPICIOUS';
  const img = inc.imageUrl
    ? `<div style="position:relative">
         <img src="${inc.imageUrl}" alt="" style="width:100%;height:172px;object-fit:cover;display:block" />
         <div style="position:absolute;top:9px;left:9px;display:flex;align-items:center;gap:6px;background:rgba(6,8,13,0.82);border:1px solid ${accent};padding:3px 7px">
           <span style="height:6px;width:6px;border-radius:999px;background:${accent}"></span>
           <span style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${accent}">${tagText}</span>
         </div>
       </div>`
    : '';
  return `<div style="width:288px">
    ${img}
    <div style="padding:11px 13px 13px">
      <div style="font-family:'Archivo',sans-serif;font-weight:700;font-size:15px;color:#f1f5ff;margin-bottom:6px;line-height:1.25">${inc.title}</div>
      <div style="font-size:13px;color:#c7d2ec;margin-bottom:11px;line-height:1.5">${inc.description}</div>
      <div style="display:flex;justify-content:space-between;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#7c8699;border-top:1px solid #1b2233;padding-top:9px">
        <span>${inc.neighborhood ?? ''}</span>
        <span>${timeAgo(inc.timestamp)}</span>
      </div>
    </div>
  </div>`;
}

export default function MapView({
  incidents,
  safeZones,
  activeRoute,
  highlightZoneId,
  avoidHotspot,
  showHeatmap,
  trip,
  onMapClick,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const incidentMarkers = useRef<maplibregl.Marker[]>([]);
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const analyticsMarkers = useRef<maplibregl.Marker[]>([]);
  const tripMarkers = useRef<maplibregl.Marker[]>([]);
  const avoidMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);

  const onMapClickRef = useRef(onMapClick);
  const onReadyRef = useRef(onReady);
  onMapClickRef.current = onMapClick;
  onReadyRef.current = onReady;

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: CITY.center,
      zoom: CITY.zoom,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: [
        [-84.95, 33.42], // SW — greater Atlanta
        [-83.95, 34.12], // NE
      ],
      pitch: 50,
      bearing: -18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('incidents', {
        type: 'geojson',
        data: incidentFeatureCollection([]),
      });
      map.addSource('safezones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Advanced shaded heatmap (hidden until toggled)
      map.addLayer({
        id: 'incident-heat',
        type: 'heatmap',
        source: 'incidents',
        maxzoom: 18,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.5, 1, 1.6],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 2, 13, 3, 16, 4.4],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(6,8,13,0)',
            0.1, 'rgba(38,95,110,0.35)',
            0.28, 'rgba(70,150,150,0.55)',
            0.45, 'rgba(255,176,0,0.82)',
            0.65, 'rgba(255,128,32,0.9)',
            0.82, 'rgba(255,69,58,0.95)',
            1, 'rgba(176,18,38,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 44, 13, 95, 16, 150],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.95, 17, 0.6],
        },
      });

      // Safe-zone heatmap (green) — shown alongside the risk heatmap
      map.addLayer({
        id: 'safezone-heat',
        type: 'heatmap',
        source: 'safezones',
        maxzoom: 18,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 1.4,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 3.6],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(8,12,24,0)',
            0.2, 'rgba(16,185,129,0.35)',
            0.45, 'rgba(34,197,94,0.6)',
            0.7, 'rgba(74,222,128,0.8)',
            1, 'rgba(134,239,172,0.92)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 40, 13, 80, 16, 130],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.85, 17, 0.5],
        },
      });

      // Route source + glow + line
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb000', 'line-width': 14, 'line-blur': 12, 'line-opacity': 0.32 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffc94d', 'line-width': 3.5 },
      });

      // Trip planner: direct (dashed, risk-tinted) + safe (amber) routes
      map.addSource('trip-direct', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('trip-safe', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'trip-direct-line',
        type: 'line',
        source: 'trip-direct',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ff6b6b',
          'line-width': 2.5,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'trip-safe-glow',
        type: 'line',
        source: 'trip-safe',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb000', 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'trip-safe-line',
        type: 'line',
        source: 'trip-safe',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffc94d', 'line-width': 4 },
      });

      loadedRef.current = true;
      onReadyRef.current();
      map.fire('bikewatch:ready');
    });

    map.on('click', (e) => {
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Update heatmap data + incident markers (markers always visible; dim under heatmap)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('incidents') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(incidentFeatureCollection(incidents));

      incidentMarkers.current.forEach((m) => m.remove());
      incidentMarkers.current = incidents.map((inc) => {
        const el = document.createElement('div');
        el.className = `incident-marker ${inc.type === 'suspicious' ? 'suspicious' : ''} ${
          inc.isNew ? 'new' : ''
        }`;
        el.style.opacity = showHeatmap ? '0.45' : '1';
        const popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '320px' }).setHTML(
          popupHtml(inc),
        );
        return new maplibregl.Marker({ element: el })
          .setLngLat([inc.lng, inc.lat])
          .setPopup(popup)
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [incidents, showHeatmap]);

  // Toggle heatmap layers + zone analytics overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const vis = showHeatmap ? 'visible' : 'none';
      if (map.getLayer('incident-heat')) map.setLayoutProperty('incident-heat', 'visibility', vis);
      if (map.getLayer('safezone-heat')) map.setLayoutProperty('safezone-heat', 'visibility', vis);

      analyticsMarkers.current.forEach((m) => m.remove());
      analyticsMarkers.current = [];
      if (!showHeatmap) return;
      const zones = computeZoneStats(incidents);
      analyticsMarkers.current = zones.map((z) => {
        const el = document.createElement('div');
        el.className = `zone-analytics tier-${z.tier.toLowerCase()}`;
        const pct = Math.round(z.stolenProbability * 100);
        el.innerHTML = `
          <div class="za-head">
            <span class="za-dot"></span>
            <span class="za-tier">${z.tier}</span>
            <span class="za-name">${z.label}</span>
          </div>
          <div class="za-prob">
            <span class="za-pct">${pct}%</span>
            <span class="za-prob-label">predicted theft odds</span>
          </div>
          <div class="za-bar"><span style="width:${pct}%"></span></div>
          <div class="za-meta">${z.count} reports · ${z.theftCount} thefts</div>`;
        return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -16] })
          .setLngLat([z.lng, z.lat])
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [showHeatmap, incidents]);

  // Safe zone markers + safe-zone heatmap data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('safezones') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: safeZones.map((z) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
          })),
        });
      }
      zoneMarkers.current.forEach((m) => m.remove());
      zoneMarkers.current = safeZones.map((z) => {
        const el = document.createElement('div');
        el.className = 'safe-zone-marker';
        el.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#04130a" stroke-width="2.4"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/></svg>';
        el.style.transform = highlightZoneId === z.id ? 'scale(1.4)' : 'scale(1)';
        el.style.transition = 'transform 0.25s ease';
        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(
          `<div style="width:212px;padding:11px 13px 12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
              <span style="height:6px;width:6px;border-radius:999px;background:#21d07a"></span>
              <span style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#21d07a">Verified Safe Zone</span>
            </div>
            <div style="font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;color:#f1f5ff;margin-bottom:4px">${z.title}</div>
            <div style="font-size:12px;color:#c7d2ec;margin-bottom:7px;line-height:1.45">${z.description}</div>
            <div style="font-family:${MONO};font-size:10px;color:#7c8699;line-height:1.45;border-top:1px solid #1b2233;padding-top:8px">${z.rationale}</div>
          </div>`,
        );
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([z.lng, z.lat])
          .setPopup(popup)
          .addTo(map);
        if (highlightZoneId === z.id) m.togglePopup();
        return m;
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [safeZones, highlightZoneId]);

  // Route rendering + fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      if (activeRoute) {
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: activeRoute.coordinates },
            },
          ],
        });
        const bounds = activeRoute.coordinates.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(
            activeRoute.coordinates[0] as [number, number],
            activeRoute.coordinates[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 160, duration: 1400, pitch: 55 });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [activeRoute]);

  // Avoid hotspot flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    avoidMarker.current?.remove();
    avoidMarker.current = null;
    if (!avoidHotspot) return;
    const fly = () => {
      map.flyTo({
        center: [avoidHotspot.lng, avoidHotspot.lat],
        zoom: 14.5,
        pitch: 58,
        duration: 1600,
      });
    };
    if (loadedRef.current) fly();
    else map.once('bikewatch:ready', fly);
  }, [avoidHotspot]);

  // Trip planner: render direct + safe routes, O/D markers, emphasize selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lineFC = (coords: [number, number][]) => ({
      type: 'FeatureCollection' as const,
      features: coords.length
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates: coords },
            },
          ]
        : [],
    });
    const apply = () => {
      const directSrc = map.getSource('trip-direct') as maplibregl.GeoJSONSource | undefined;
      const safeSrc = map.getSource('trip-safe') as maplibregl.GeoJSONSource | undefined;
      if (!directSrc || !safeSrc) return;

      tripMarkers.current.forEach((m) => m.remove());
      tripMarkers.current = [];

      if (!trip) {
        directSrc.setData(lineFC([]));
        safeSrc.setData(lineFC([]));
        return;
      }

      const safe = trip.options.find((o) => o.kind === 'safe');
      const direct = trip.options.find((o) => o.kind === 'direct');
      safeSrc.setData(lineFC(safe?.coordinates ?? []));
      directSrc.setData(lineFC(direct?.coordinates ?? []));

      const safeSel = trip.selectedId === 'safe';
      if (map.getLayer('trip-safe-line')) {
        map.setPaintProperty('trip-safe-line', 'line-width', safeSel ? 4.5 : 2.5);
        map.setPaintProperty('trip-safe-line', 'line-opacity', safeSel ? 1 : 0.4);
      }
      if (map.getLayer('trip-safe-glow')) {
        map.setPaintProperty('trip-safe-glow', 'line-opacity', safeSel ? 0.32 : 0.1);
      }
      if (map.getLayer('trip-direct-line')) {
        map.setPaintProperty('trip-direct-line', 'line-width', safeSel ? 2.5 : 3.8);
        map.setPaintProperty('trip-direct-line', 'line-opacity', safeSel ? 0.45 : 0.95);
      }

      const makeEndpoint = (label: string, isDest: boolean, lat: number, lng: number) => {
        const el = document.createElement('div');
        el.className = `trip-endpoint ${isDest ? 'dest' : ''}`;
        el.textContent = label;
        return new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      };
      tripMarkers.current = [
        makeEndpoint('A', false, trip.origin.lat, trip.origin.lng),
        makeEndpoint('B', true, trip.destination.lat, trip.destination.lng),
      ];

      const coords = [
        ...(safe?.coordinates ?? []),
        ...(direct?.coordinates ?? []),
      ];
      if (coords.length) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: { top: 120, bottom: 90, left: 330, right: 110 }, duration: 1200, pitch: 48 });
      }
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [trip]);

  return <div ref={containerRef} className="h-full w-full" />;
}
