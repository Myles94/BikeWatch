import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Incident, SafeRoute, SafeZone } from '../lib/types';
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

function popupHtml(inc: Incident) {
  const tag =
    inc.type === 'theft'
      ? '<span style="color:#fca5a5">Theft</span>'
      : '<span style="color:#fcd34d">Suspicious</span>';
  const img = inc.imageUrl
    ? `<img src="${inc.imageUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;display:block" />`
    : '';
  return `<div style="width:212px">
    ${img}
    <div style="font-weight:600;font-size:13px;color:#f1f5ff;margin-bottom:3px;line-height:1.25">${inc.title}</div>
    <div style="font-size:12px;color:#c7d2ec;margin-bottom:8px;line-height:1.4">${inc.description}</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#93a3c9">
      <span>${inc.neighborhood ?? ''}</span>
      <span>${tag} · ${timeAgo(inc.timestamp)}</span>
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
  onMapClick,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const incidentMarkers = useRef<maplibregl.Marker[]>([]);
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const analyticsMarkers = useRef<maplibregl.Marker[]>([]);
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

      // Advanced shaded heatmap (hidden until toggled)
      map.addLayer({
        id: 'incident-heat',
        type: 'heatmap',
        source: 'incidents',
        maxzoom: 17,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.35, 1, 1.4],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 13, 2.4, 16, 3.8],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(8,12,24,0)',
            0.12, 'rgba(34,211,238,0.4)',
            0.28, 'rgba(56,189,248,0.6)',
            0.45, 'rgba(250,204,21,0.78)',
            0.62, 'rgba(249,115,22,0.88)',
            0.8, 'rgba(239,68,68,0.94)',
            1, 'rgba(190,18,60,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 28, 13, 58, 16, 92],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.95, 16.5, 0.55],
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
        paint: { 'line-color': '#34d399', 'line-width': 16, 'line-blur': 14, 'line-opacity': 0.4 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#6ee7b7', 'line-width': 3.5 },
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
        const popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '240px' }).setHTML(
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

  // Toggle heatmap layer + zone analytics overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer('incident-heat')) {
        map.setLayoutProperty('incident-heat', 'visibility', showHeatmap ? 'visible' : 'none');
      }
      analyticsMarkers.current.forEach((m) => m.remove());
      analyticsMarkers.current = [];
      if (!showHeatmap) return;
      const zones = computeZoneStats(incidents);
      analyticsMarkers.current = zones.map((z) => {
        const el = document.createElement('div');
        el.className = `zone-analytics tier-${z.tier.toLowerCase()}`;
        el.innerHTML = `
          <div class="za-tier">${z.tier} risk</div>
          <div class="za-name">${z.label}</div>
          <div class="za-meta">${z.count} reports · ${z.theftCount} thefts</div>`;
        return new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([z.lng, z.lat])
          .addTo(map);
      });
    };
    if (loadedRef.current) apply();
    else map.once('bikewatch:ready', apply);
  }, [showHeatmap, incidents]);

  // Safe zone markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      zoneMarkers.current.forEach((m) => m.remove());
      zoneMarkers.current = safeZones.map((z) => {
        const el = document.createElement('div');
        el.className = 'safe-zone-marker';
        el.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#04130a" stroke-width="2.4"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/></svg>';
        el.style.transform = highlightZoneId === z.id ? 'scale(1.4)' : 'scale(1)';
        el.style.transition = 'transform 0.25s ease';
        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '230px' }).setHTML(
          `<div style="width:198px">
            <div style="font-weight:600;font-size:13px;color:#6ee7b7;margin-bottom:3px">${z.title}</div>
            <div style="font-size:12px;color:#c7d2ec;margin-bottom:6px;line-height:1.4">${z.description}</div>
            <div style="font-size:11px;color:#93a3c9;line-height:1.4">${z.rationale}</div>
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

  return <div ref={containerRef} className="h-full w-full" />;
}
