import type { StyleSpecification } from 'maplibre-gl';

/**
 * Custom cinematic dark basemap for BikeWatch.
 *
 * Uses OpenFreeMap (https://openfreemap.org) — fully free, no API key, no rate
 * limits — with the OpenMapTiles vector schema. We hand-tune the paint so the
 * city geography reads clearly against a deep navy base: visible water, parks,
 * 3D building extrusions, a strong road hierarchy, and high-contrast labels.
 *
 * To swap in a premium provider later, point `OPENMAPTILES` at another tile
 * source (e.g. via an env token) — the layer styling stays the same.
 */

const OFM = 'https://tiles.openfreemap.org';

const C = {
  land: '#070b14',
  landAlt: '#0a1020',
  water: '#0b2942',
  waterDeep: '#0d3454',
  park: '#0e2417',
  parkAlt: '#102a1b',
  wood: '#0c2014',
  building: '#141d33',
  buildingTop: '#1b2742',
  buildingExtrude: '#16213a',
  roadMinor: '#1b2238',
  roadMajor: '#2a3553',
  roadPrimary: '#36456b',
  motorway: '#46567f',
  motorwayCase: '#0a0f1c',
  rail: '#222b44',
  boundary: '#2b3a5c',
  label: '#cdd9f5',
  labelMinor: '#8294bd',
  labelHalo: '#05080f',
  water_label: '#5f86c2',
};

export const DARK_STYLE: StyleSpecification = {
  version: 8,
  name: 'BikeWatch Noir',
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  sprite: `${OFM}/sprites/ofm_f384/ofm`,
  sources: {
    openmaptiles: {
      type: 'vector',
      url: `${OFM}/planet`,
    },
  },
  light: {
    anchor: 'viewport',
    color: '#9fb4e0',
    intensity: 0.35,
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': C.land },
    },
    // ---- Land use / cover ----
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'residential'],
      paint: {
        'fill-color': C.landAlt,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.55],
      },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': C.wood, 'fill-opacity': 0.6 },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'meadow', 'wetland']]],
      paint: { 'fill-color': C.parkAlt, 'fill-opacity': 0.55 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'cemetery', 'pitch', 'golf_course', 'recreation_ground']]],
      paint: { 'fill-color': C.park, 'fill-opacity': 0.75 },
    },
    {
      id: 'park-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'park'],
      paint: { 'line-color': '#16361f', 'line-width': 0.6, 'line-opacity': 0.6 },
    },
    // ---- Water ----
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['!=', ['get', 'intermittent'], 1],
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          C.water,
          12,
          C.waterDeep,
        ],
      },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: {
        'line-color': C.water,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 2.4],
        'line-opacity': 0.9,
      },
    },
    // ---- Buildings (2D fill + 3D extrusion) ----
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      maxzoom: 15,
      paint: {
        'fill-color': C.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.6],
        'fill-outline-color': '#1c2842',
      },
    },
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0,
          C.buildingExtrude,
          40,
          C.buildingTop,
          120,
          '#243a5e',
        ],
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          15,
          ['get', 'render_height'],
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          15,
          ['get', 'render_min_height'],
        ],
        'fill-extrusion-opacity': 0.85,
      },
    },
    // ---- Roads ----
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
      minzoom: 12,
      paint: {
        'line-color': C.roadMinor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 3],
      },
    },
    {
      id: 'road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'cycleway', 'footway']]],
      minzoom: 13,
      paint: {
        'line-color': '#27406a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 17, 2],
        'line-dasharray': [2, 1.5],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      paint: {
        'line-color': C.roadMajor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 3, 18, 9],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk']]],
      paint: {
        'line-color': C.roadPrimary,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 4, 18, 12],
      },
    },
    {
      id: 'road-motorway-case',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      paint: {
        'line-color': C.motorwayCase,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 14, 7, 18, 18],
        'line-gap-width': 0,
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      paint: {
        'line-color': C.motorway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 14, 4.5, 18, 13],
      },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      minzoom: 12,
      paint: {
        'line-color': C.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1.6],
      },
    },
    // ---- Boundaries ----
    {
      id: 'boundary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: {
        'line-color': '#2b3a5c',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 1.4],
        'line-dasharray': [3, 2],
        'line-opacity': 0.5,
      },
    },
    // ---- Labels ----
    {
      id: 'water-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': C.water_label,
        'text-halo-color': C.labelHalo,
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 13],
        'symbol-placement': 'line',
      },
      paint: {
        'text-color': C.labelMinor,
        'text-halo-color': C.labelHalo,
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'place-suburb',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14],
        'text-letter-spacing': 0.18,
        'text-transform': 'uppercase',
        'text-max-width': 7,
      },
      paint: {
        'text-color': C.labelMinor,
        'text-halo-color': C.labelHalo,
        'text-halo-width': 1.4,
      },
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 16],
      },
      paint: {
        'text-color': C.label,
        'text-halo-color': C.labelHalo,
        'text-halo-width': 1.6,
      },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 13, 12, 22],
        'text-letter-spacing': 0.05,
      },
      paint: {
        'text-color': '#eaf1ff',
        'text-halo-color': C.labelHalo,
        'text-halo-width': 1.8,
      },
    },
  ],
};
