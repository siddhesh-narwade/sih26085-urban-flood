import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  MapPin, 
  Activity, 
  CloudRain, 
  AlertTriangle,
  Building2,
  Navigation
} from 'lucide-react';
import { 
  SimulationResult, 
  TimelineStep, 
  RoutePlanResponse, 
  POIFeature
} from '../types';
import { MosdacStatus } from '../services/api';

interface MapViewProps {
  roadsGeoJSON: any;
  drainageNodesGeoJSON: any;
  drainageEdgesGeoJSON: any;
  poisGeoJSON: any;
  simulation: SimulationResult | null;
  mosdacStatus: MosdacStatus | null;
  currentStepIndex: number;
  selectedRoute: RoutePlanResponse | null;
  onSelectRoad: (roadId: string) => void;
  onSelectDrainageNode: (nodeId: string) => void;
  onClearRoute?: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  roadsGeoJSON,
  drainageNodesGeoJSON,
  drainageEdgesGeoJSON,
  poisGeoJSON,
  simulation,
  mosdacStatus,
  currentStepIndex,
  selectedRoute,
  onSelectRoad,
  onSelectDrainageNode,
  onClearRoute
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups refs
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const roadsLayerRef = useRef<L.GeoJSON | null>(null);
  const drainagePipesLayerRef = useRef<L.GeoJSON | null>(null);
  const drainageNodesLayerRef = useRef<L.LayerGroup | null>(null);
  const poisLayerRef = useRef<L.LayerGroup | null>(null);
  const radarLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const [showStreets, setShowStreets] = useState<boolean>(true);
  const [showDrainage, setShowDrainage] = useState<boolean>(true);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showPOIs, setShowPOIs] = useState<boolean>(true);
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [basemapStyle, setBasemapStyle] = useState<string>('esri_satellite');

  const TILE_PROVIDERS: Record<string, { name: string; url: string; options: L.TileLayerOptions }> = {
    carto_dark: {
      name: '🌃 CartoDB Dark Matter (Recommended - Free)',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      options: { maxZoom: 19, maxNativeZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' }
    },
    carto_voyager: {
      name: '🧭 CartoDB Voyager (Vibrant - Free)',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      options: { maxZoom: 19, maxNativeZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' }
    },
    esri_dark: {
      name: '🌌 Esri Dark Gray Canvas (Free)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 19, maxNativeZoom: 16, attribution: 'Tiles &copy; Esri' }
    },
    esri_satellite: {
      name: '🛰️ Satellite / Aerial View (Free)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
    },
    esri_streets: {
      name: '🏙️ Esri World Street Map (Free)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles &copy; Esri' }
    },
    osm: {
      name: '🗺️ OpenStreetMap Standard (Free)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 19, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
    }
  };

  const currentStep: TimelineStep | undefined = simulation?.timeline[currentStepIndex];

  // Helper color for water depth
  const getDepthColor = (depthCm: number) => {
    if (depthCm <= 2.0) return '#10b981'; // Passable Green
    if (depthCm <= 5.0) return '#22c55e'; // Normal
    if (depthCm <= 15.0) return '#f59e0b'; // Caution Amber
    if (depthCm <= 30.0) return '#f97316'; // Warning Orange
    if (depthCm <= 50.0) return '#ef4444'; // Severe Red
    return '#a855f7'; // Critical Submerged Purple
  };

  // Helper color for pipe utilization
  const getPipeUtilColor = (utilPct: number, isSurcharged: boolean) => {
    if (isSurcharged || utilPct >= 100.0) return '#ec4899'; // Surcharge Pink
    if (utilPct >= 80.0) return '#f59e0b'; // Amber Warning
    if (utilPct >= 50.0) return '#38bdf8'; // Sky Blue Normal Flow
    return '#0284c7'; // Deep Blue Low Flow
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Kurla West - BKC Corridor
    const map = L.map(mapContainerRef.current, {
      center: [19.0725, 72.8750],
      zoom: 14,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups
    drainageNodesLayerRef.current = L.layerGroup().addTo(map);
    poisLayerRef.current = L.layerGroup().addTo(map);
    radarLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 1b. Switch Basemap Tiles (No API key required)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const provider = TILE_PROVIDERS[basemapStyle] || TILE_PROVIDERS.esri_dark;
    const newTileLayer = L.tileLayer(provider.url, provider.options).addTo(mapInstanceRef.current);
    newTileLayer.once('tileerror', () => {
      if (basemapStyle === 'esri_satellite' && mapInstanceRef.current) {
        console.warn('Satellite imagery unavailable; keeping the OpenStreetMap street layer active.');
        setBasemapStyle('osm');
      }
    });
    tileLayerRef.current = newTileLayer;
  }, [basemapStyle]);

  // 2. Render & Update Roads Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !roadsGeoJSON) return;

    if (roadsLayerRef.current) {
      roadsLayerRef.current.remove();
    }

    if (!showStreets) return;

    const roadsState = currentStep?.roads || {};

    const roadsLayer = L.geoJSON(roadsGeoJSON, {
      style: (feature) => {
        const roadId = feature?.properties?.road_id;
        const simData = roadsState[roadId];
        const depth = simData ? simData.water_depth_cm : 0.0;
        const color = getDepthColor(depth);
        const weight = depth > 15.0 ? 7 : (feature?.properties?.road_type === 'arterial' ? 5 : 3.5);

        return {
          color: color,
          weight: weight,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const roadId = p.road_id;
        const simData = roadsState[roadId];
        const depth = simData ? simData.water_depth_cm : 0.0;
        const risk = simData ? simData.risk_level : 'LOW';
        const rain = simData ? simData.rainfall_intensity_mmh : 0.0;
        const surch = simData ? simData.surcharge_m3s : 0.0;

        layer.bindTooltip(
          `<div class="p-1.5 font-mono text-xs">
            <div class="font-bold text-sky-300">${p.name}</div>
            <div class="text-slate-300">Depth: <span class="font-bold ${depth > 15 ? 'text-red-400' : 'text-emerald-400'}">${depth} cm</span></div>
            <div class="text-slate-400">Risk: <span class="font-bold">${risk}</span> | Rain: ${rain} mm/h</div>
            ${surch > 0 ? `<div class="text-pink-400 font-bold">⚠️ Drain Surcharge: ${surch} m³/s</div>` : ''}
            <div class="text-[10px] text-sky-400 mt-1">Click to inspect root causes (XAI)</div>
          </div>`,
          { sticky: true }
        );

        layer.on('click', () => {
          onSelectRoad(roadId);
        });
      }
    }).addTo(mapInstanceRef.current);

    roadsLayerRef.current = roadsLayer;
  }, [roadsGeoJSON, currentStep, showStreets, onSelectRoad]);

  // 3. Render & Update Drainage Pipes and Nodes
  useEffect(() => {
    if (!mapInstanceRef.current || !drainageNodesLayerRef.current) return;

    if (drainagePipesLayerRef.current) drainagePipesLayerRef.current.remove();
    drainageNodesLayerRef.current.clearLayers();

    if (!showDrainage) return;

    const edgeState = currentStep?.drainage_edges || {};
    const nodeState = currentStep?.drainage_nodes || {};

    // Drainage Conduits
    if (drainageEdgesGeoJSON) {
      const pipesLayer = L.geoJSON(drainageEdgesGeoJSON, {
        style: (feature) => {
          const edgeId = feature?.properties?.edge_id;
          const status = edgeState[edgeId];
          const utilPct = status ? status.utilization_pct : 40;
          const isSurch = status ? status.status === 'SURCHARGE' : false;
          return {
            color: getPipeUtilColor(utilPct, isSurch),
            weight: isSurch ? 5 : 3,
            dashArray: '6, 6',
            opacity: 0.85
          };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const edgeId = p.edge_id;
          const status = edgeState[edgeId];
          const util = status ? status.utilization_pct : 0;
          const flow = status ? status.flow_m3s : 0;
          const cap = status ? status.capacity_m3s : p.base_capacity_m3s;

          layer.bindTooltip(
            `<div class="p-1 font-mono text-xs">
              <div class="font-bold text-teal-300">Conduit: ${edgeId} (Ø${p.diameter_mm}mm)</div>
              <div>Flow: ${flow} / ${cap} m³/s</div>
              <div>Utilization: <span class="font-bold ${util > 90 ? 'text-pink-400' : 'text-sky-300'}">${util}%</span></div>
            </div>`
          );
        }
      }).addTo(mapInstanceRef.current);
      drainagePipesLayerRef.current = pipesLayer;
    }

    // Drainage Nodes (Manholes & Inlets) - Pink surcharge points are STATIC directly pointing to drains
    if (drainageNodesGeoJSON) {
      drainageNodesGeoJSON.features.forEach((feature: any) => {
        const [lon, lat] = feature.geometry.coordinates;
        const latlng: L.LatLngExpression = [lat, lon];
        const p = feature.properties;
        const nodeId = p.node_id;
        const stat = nodeState[nodeId];
        const isSurch = stat ? stat.is_surcharged : false;
        const nodeType = p.node_type;

        if (isSurch) {
          // Static pin anchored directly over the drain node with informative static callout
          const surchIcon = L.divIcon({
            className: 'surcharge-static-marker-wrapper',
            html: `
              <div class="flex flex-col items-center select-none" style="transform: translate(-50%, -100%); cursor: pointer;">
                <div class="bg-[#1e1028] border-2 border-pink-500 text-pink-200 px-2.5 py-1.5 rounded-xl shadow-2xl font-mono text-[10px] font-bold text-center border-l-4 border-l-pink-500 whitespace-nowrap">
                  <div class="text-pink-400 font-extrabold flex items-center justify-center space-x-1">
                    <span>⚠️ SURCHARGE DRAIN</span>
                  </div>
                  <div class="text-white text-[10px]">${p.name || nodeId}</div>
                  <div class="text-pink-300 text-[10px]">Backflow: <span class="font-extrabold text-pink-400">${stat?.surcharge_m3s || '0.0'} m³/s</span></div>
                </div>
                <div class="w-2.5 h-2.5 bg-pink-500 rotate-45 -mt-1 shadow-md"></div>
                <div class="surcharge-marker-core w-3.5 h-3.5 rounded-full bg-pink-500 border-2 border-white shadow-xl mt-0.5"></div>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          });

          const marker = L.marker(latlng, { icon: surchIcon });
          marker.on('click', () => onSelectDrainageNode(nodeId));
          drainageNodesLayerRef.current?.addLayer(marker);
        } else {
          // Static clean circle marker for non-surcharging node
          let markerColor = '#38bdf8';
          if (nodeType === 'outfall') markerColor = '#818cf8';

          const marker = L.circleMarker(latlng, {
            radius: 6,
            fillColor: markerColor,
            color: '#0f172a',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.9
          });

          marker.bindTooltip(
            `<div class="p-1 font-mono text-xs">
              <div class="font-bold text-sky-300">${p.name}</div>
              <div>Type: ${nodeType.toUpperCase()}</div>
              <div>Status: Normal Conveyance</div>
            </div>`
          );

          marker.on('click', () => {
            onSelectDrainageNode(nodeId);
          });

          drainageNodesLayerRef.current?.addLayer(marker);
        }
      });
    }
  }, [drainageNodesGeoJSON, drainageEdgesGeoJSON, currentStep, showDrainage, onSelectDrainageNode]);

  // 4. Render Critical POIs
  useEffect(() => {
    if (!mapInstanceRef.current || !poisLayerRef.current || !poisGeoJSON) return;

    poisLayerRef.current.clearLayers();

    if (!showPOIs) return;

    poisGeoJSON.features.forEach((poi: POIFeature) => {
      const [lon, lat] = poi.geometry.coordinates;
      const p = poi.properties;

      let iconHtml = '<div class="w-7 h-7 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center text-emerald-300 text-xs font-bold shadow-lg">🏥</div>';
      if (p.poi_type === 'fire_station') {
        iconHtml = '<div class="w-7 h-7 rounded-full bg-red-500/30 border border-red-400 flex items-center justify-center text-red-300 text-xs font-bold shadow-lg">🚒</div>';
      } else if (p.poi_type === 'transit_hub') {
        iconHtml = '<div class="w-7 h-7 rounded-full bg-amber-500/30 border border-amber-400 flex items-center justify-center text-amber-300 text-xs font-bold shadow-lg">🚆</div>';
      }

      const customIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([lat, lon], { icon: customIcon });
      marker.bindPopup(
        `<div class="p-2 font-mono text-xs">
          <div class="font-bold text-sky-400 text-sm mb-1">${p.name}</div>
          <div class="text-slate-300 mb-1">${p.description}</div>
          <div class="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-bold">${p.criticality}</div>
        </div>`
      );

      poisLayerRef.current?.addLayer(marker);
    });
  }, [poisGeoJSON, showPOIs]);

  // Show observed MOSDAC cells for the live scenario and the modeled storm core for simulations.
  useEffect(() => {
    if (!mapInstanceRef.current || !radarLayerRef.current) return;
    radarLayerRef.current.clearLayers();
    if (!showRadar) return;

    if (simulation?.metadata.scenario_id !== 'mosdac_live_satellite_dwr' && currentStep?.storm_center) {
      const [stormLat, stormLon] = currentStep.storm_center;
      const peakRain = currentStep.current_rainfall_peak_mmh || 0;
      if (peakRain > 0) {
        const simulatedCircle = L.circle([stormLat, stormLon], {
          className: 'radar-range-ring',
          radius: Math.min(3000, Math.max(1200, peakRain * 22)),
          fillColor: '#0ea5e9',
          fillOpacity: 0.18,
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '4, 6'
        });
        const simulatedCore = L.circleMarker([stormLat, stormLon], {
          className: 'radar-core-marker',
          radius: 12,
          fillColor: '#38bdf8',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.7
        });
        simulatedCircle.bindTooltip(`Simulated rainfall radar: ${peakRain} mm/hr`, { sticky: true });
        radarLayerRef.current.addLayer(simulatedCircle);
        radarLayerRef.current.addLayer(simulatedCore);
      }
      return;
    }

    const observedSamples = mosdacStatus?.spatial_samples?.filter((sample) => sample.rain_mmh > 0) || [];
    if (!observedSamples.length) return;

    observedSamples.forEach((sample) => {
      const radius = Math.min(900, Math.max(250, sample.rain_mmh * 30));
      const observedCell = L.circle([sample.lat, sample.lon], {
        className: 'radar-observed-cell',
        radius,
        fillColor: '#22c55e',
        fillOpacity: 0.2,
        color: '#86efac',
        weight: 1
      });
      observedCell.bindTooltip(`Observed MOSDAC rainfall: ${sample.rain_mmh} mm/hr`, { sticky: true });
      radarLayerRef.current?.addLayer(observedCell);
    });
  }, [currentStep, mosdacStatus, showRadar, simulation]);

  // 6. Render Active Routing Overlay with Source, Destination, and 2 Efficient Paths in Different Colors
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    if (!showRoute || !selectedRoute) return;

    const allRouteLatLngs: L.LatLng[] = [];

    // Extract start and dest coordinates & names
    let startLat: number | null = null;
    let startLon: number | null = null;
    let destLat: number | null = null;
    let destLon: number | null = null;

    if (selectedRoute.start_coords && selectedRoute.start_coords.length === 2) {
      [startLon, startLat] = selectedRoute.start_coords;
    }
    if (selectedRoute.dest_coords && selectedRoute.dest_coords.length === 2) {
      [destLon, destLat] = selectedRoute.dest_coords;
    }

    // 1. Direct / Baseline Corridor (Path 2) — Render in Vibrant Blue (or Red if submerged)
    if (selectedRoute.direct_route_segments && selectedRoute.direct_route_segments.length > 0) {
      const directCoords: [number, number][] = [];
      selectedRoute.direct_route_segments.forEach((seg, sIdx) => {
        seg.coordinates.forEach(([lon, lat], cIdx) => {
          if (sIdx > 0 && cIdx === 0) return;
          directCoords.push([lat, lon]);
        });
      });

      if (!startLat && directCoords.length > 0) {
        [startLat, startLon] = directCoords[0];
      }
      if (!destLat && directCoords.length > 0) {
        [destLat, destLon] = directCoords[directCoords.length - 1];
      }

      directCoords.forEach(([lat, lon]) => allRouteLatLngs.push(L.latLng(lat, lon)));

      const path2Color = selectedRoute.direct_route_is_flooded ? '#ef4444' : '#3b82f6';

      const directLine = L.polyline(directCoords, {
        className: 'baseline-route-flow',
        color: path2Color,
        weight: 5,
        dashArray: selectedRoute.direct_route_is_flooded ? '6, 8' : '4, 4',
        opacity: 0.9
      });

      const path2Label = selectedRoute.direct_route_is_flooded
        ? `🔴 Path 2 (Direct Corridor - SUBMERGED): ${(selectedRoute.direct_route_distance_m / 1000).toFixed(2)}km, Max Water: ${selectedRoute.direct_route_max_depth_cm}cm`
        : `🔵 Path 2 (Direct Corridor): ${(selectedRoute.direct_route_distance_m / 1000).toFixed(2)}km, ETA: ${selectedRoute.direct_route_eta_min}m, Max Water: ${selectedRoute.direct_route_max_depth_cm}cm`;

      directLine.bindTooltip(
        `<div class="p-1.5 font-mono text-xs">
          <div class="font-bold ${selectedRoute.direct_route_is_flooded ? 'text-red-400' : 'text-blue-400'}">${path2Label}</div>
          <div class="text-slate-300">Click to compare corridor features</div>
        </div>`,
        { sticky: true }
      );
      routeLayerRef.current.addLayer(directLine);
    }

    // 2. Safe Flood-Avoidance Route (Path 1) — Render in Bright Neon Emerald Green
    if (selectedRoute.safe_route_found && selectedRoute.safe_route_segments) {
      const safeCoords: [number, number][] = [];
      selectedRoute.safe_route_segments.forEach((seg, sIdx) => {
        seg.coordinates.forEach(([lon, lat], cIdx) => {
          if (sIdx > 0 && cIdx === 0) return;
          safeCoords.push([lat, lon]);
        });
      });

      if (!startLat && safeCoords.length > 0) {
        [startLat, startLon] = safeCoords[0];
      }
      if (!destLat && safeCoords.length > 0) {
        [destLat, destLon] = safeCoords[safeCoords.length - 1];
      }

      safeCoords.forEach(([lat, lon]) => allRouteLatLngs.push(L.latLng(lat, lon)));

      const safeLine = L.polyline(safeCoords, {
        className: 'safe-route-flow',
        color: '#10b981',
        weight: 7,
        dashArray: '10, 12',
        opacity: 0.95
      });

      safeLine.bindTooltip(
        `<div class="p-1.5 font-mono text-xs">
          <div class="font-bold text-emerald-400">🟢 Path 1 (Primary Flood-Safe Efficient Path)</div>
          <div class="text-slate-200">Distance: ${(selectedRoute.safe_route_distance_m / 1000).toFixed(2)} km | ETA: ${selectedRoute.safe_route_eta_min} min</div>
          <div class="text-emerald-300">Max Water Depth: ${selectedRoute.safe_route_max_depth_cm} cm</div>
        </div>`,
        { sticky: true }
      );
      routeLayerRef.current.addLayer(safeLine);
    }

    // 2b. INTERMEDIATE ROAD SEGMENTS & JUNCTION LABELS
    const activeRouteSegments = selectedRoute.safe_route_found && selectedRoute.safe_route_segments.length > 0
      ? selectedRoute.safe_route_segments
      : selectedRoute.direct_route_segments;

    if (activeRouteSegments && activeRouteSegments.length > 0) {
      activeRouteSegments.forEach((seg) => {
        if (seg.coordinates && seg.coordinates.length >= 2) {
          // Midpoint of road segment
          const midIdx = Math.floor(seg.coordinates.length / 2);
          const [midLon, midLat] = seg.coordinates[midIdx];

          const roadLabelIcon = L.divIcon({
            className: 'custom-road-name-badge',
            html: `
              <div class="bg-slate-950/90 border border-sky-500/60 text-sky-200 px-2 py-0.5 rounded text-[10px] font-mono shadow-lg flex items-center space-x-1 whitespace-nowrap -translate-x-1/2 -translate-y-1/2">
                <span>🛣️ ${seg.road_name}</span>
                <span class="text-[9px] px-1 rounded ${seg.water_depth_cm > 15 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-800 text-slate-300'}">
                  ${seg.water_depth_cm}cm
                </span>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          });

          const segMarker = L.marker([midLat, midLon], { icon: roadLabelIcon, interactive: false });
          routeLayerRef.current?.addLayer(segMarker);
        }
      });
    }

    // 3. SOURCE MARKER (Start Pin)
    if (startLat !== null && startLon !== null) {
      const sourceName = selectedRoute.start_name || selectedRoute.start_node_id || 'SOURCE';
      const sourceIcon = L.divIcon({
        className: 'custom-source-pin',
        html: `
          <div class="flex flex-col items-center select-none" style="transform: translate(-50%, -100%);">
            <div class="bg-[#0f172a] border-2 border-emerald-400 text-emerald-300 px-3 py-1.5 rounded-2xl shadow-2xl font-mono text-xs font-bold flex items-center space-x-1.5 border-b-4 border-b-emerald-400 whitespace-nowrap">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 animate-ping"></span>
              <span>SOURCE: ${sourceName}</span>
            </div>
            <div class="w-3 h-3 bg-emerald-400 rotate-45 -mt-1.5 shadow-lg"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const sourceMarker = L.marker([startLat, startLon], { icon: sourceIcon });
      sourceMarker.bindTooltip(`<div class="font-mono text-xs font-bold text-emerald-400">Origin Dispatch: ${sourceName}</div>`);
      routeLayerRef.current.addLayer(sourceMarker);
      allRouteLatLngs.push(L.latLng(startLat, startLon));
    }

    // 4. DESTINATION MARKER (Destination Pin)
    if (destLat !== null && destLon !== null) {
      const destName = selectedRoute.destination_name || selectedRoute.destination_node_id || 'DESTINATION';
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div class="flex flex-col items-center select-none" style="transform: translate(-50%, -100%);">
            <div class="bg-[#0f172a] border-2 border-rose-500 text-rose-300 px-3 py-1.5 rounded-2xl shadow-2xl font-mono text-xs font-bold flex items-center space-x-1.5 border-b-4 border-b-rose-500 whitespace-nowrap">
              <span class="text-sm">🏁</span>
              <span>DESTINATION: ${destName}</span>
            </div>
            <div class="w-3 h-3 bg-rose-500 rotate-45 -mt-1.5 shadow-lg"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const destMarker = L.marker([destLat, destLon], { icon: destIcon });
      destMarker.bindTooltip(`<div class="font-mono text-xs font-bold text-rose-400">Emergency Hub: ${destName}</div>`);
      routeLayerRef.current.addLayer(destMarker);
      allRouteLatLngs.push(L.latLng(destLat, destLon));
    }

    // Auto-fit map bounds to encompass source, destination, and paths
    if (allRouteLatLngs.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(allRouteLatLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    }
  }, [selectedRoute, showRoute]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Tactical Layer Toggles */}
      <div className="absolute top-4 left-4 z-10 bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl space-y-2 text-xs font-mono">
        <div className="flex items-center space-x-2 text-sky-400 font-bold border-b border-slate-800 pb-1.5 mb-2">
          <Layers className="w-4 h-4" />
          <span>GIS Command Layers</span>
        </div>

        <label className="flex items-center justify-between space-x-3 cursor-pointer text-slate-300 hover:text-white">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Street Flood Depth (cm)</span>
          </span>
          <input
            type="checkbox"
            checked={showStreets}
            onChange={(e) => setShowStreets(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between space-x-3 cursor-pointer text-slate-300 hover:text-white">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>Drainage Network & Surcharge</span>
          </span>
          <input
            type="checkbox"
            checked={showDrainage}
            onChange={(e) => setShowDrainage(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between space-x-3 cursor-pointer text-slate-300 hover:text-white">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span>Precipitation Radar</span>
          </span>
          <input
            type="checkbox"
            checked={showRadar}
            onChange={(e) => setShowRadar(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>

        <div className="border-t border-slate-800 pt-2 text-[10px] space-y-1">
          <div className="flex justify-between gap-3"><span className="text-slate-500">Observed now</span><span className="text-emerald-300 font-bold">{mosdacStatus ? `${mosdacStatus.max_rain_mmh} mm/hr` : 'Loading...'}</span></div>
          {simulation?.metadata.scenario_id === 'mosdac_live_satellite_dwr' ? (
            <div className="text-slate-500">{mosdacStatus?.max_rain_mmh === 0 ? 'No observed rain in MOSDAC HDF5 field' : 'Green cells = parsed MOSDAC field'}</div>
          ) : (
            <div className="text-amber-300">Blue core = simulated scenario radar</div>
          )}
        </div>

        <label className="flex items-center justify-between space-x-3 cursor-pointer text-slate-300 hover:text-white">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Critical POIs (Hospitals/Fire)</span>
          </span>
          <input
            type="checkbox"
            checked={showPOIs}
            onChange={(e) => setShowPOIs(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>

        {selectedRoute && (
          <label className="flex items-center justify-between space-x-3 cursor-pointer text-slate-300 hover:text-white">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
              <span>Active Emergency Route</span>
            </span>
            <input
              type="checkbox"
              checked={showRoute}
              onChange={(e) => setShowRoute(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
            />
          </label>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase">Base Map</div>
          <select
            value={basemapStyle}
            onChange={(e) => setBasemapStyle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-sky-300 text-[11px] rounded p-1.5 font-mono focus:ring-0 focus:outline-none cursor-pointer"
          >
            {Object.entries(TILE_PROVIDERS).map(([key, provider]) => (
              <option key={key} value={key}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* On-Map Simplified Route Information Overlay Box */}
      {selectedRoute && (
        <div className="absolute top-4 right-4 z-10 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs font-mono max-w-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-1.5 text-sky-400 font-extrabold uppercase">
              <Navigation className="w-4 h-4" />
              <span>Simplified Route Guidance</span>
            </div>
            {onClearRoute && (
              <button
                onClick={onClearRoute}
                className="text-slate-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Source & Destination summary */}
          <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span>Source: {selectedRoute.start_name || selectedRoute.start_node_id}</span>
            </div>
            <div className="flex items-center space-x-2 text-rose-400 font-bold truncate">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              <span>Destination: {selectedRoute.destination_name || selectedRoute.destination_node_id}</span>
            </div>
          </div>

          {/* Color-coded Route Comparison */}
          <div className="space-y-2">
            {/* Path 1: Safe Path */}
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <span className="w-3.5 h-1.5 bg-[#10b981] rounded-full inline-block"></span>
                  <span>Path 1 (Flood-Safe Efficient Path)</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  ETA: <span className="text-emerald-300 font-bold">{selectedRoute.safe_route_eta_min}m</span> | Dist: {(selectedRoute.safe_route_distance_m / 1000).toFixed(2)}km
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-[9px] text-slate-400 uppercase">Max Depth</div>
                <div className="text-xs font-bold text-emerald-400">{selectedRoute.safe_route_max_depth_cm} cm</div>
              </div>
            </div>

            {/* Path 2: Direct Corridor */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              selectedRoute.direct_route_is_flooded
                ? 'bg-rose-950/40 border-rose-500/50'
                : 'bg-blue-950/40 border-blue-500/50'
            }`}>
              <div className="space-y-0.5">
                <div className={`flex items-center space-x-1.5 font-bold ${
                  selectedRoute.direct_route_is_flooded ? 'text-rose-400' : 'text-blue-400'
                }`}>
                  <span className={`w-3.5 h-1.5 rounded-full inline-block ${
                    selectedRoute.direct_route_is_flooded ? 'bg-[#ef4444]' : 'bg-[#3b82f6]'
                  }`}></span>
                  <span>Path 2 ({selectedRoute.direct_route_is_flooded ? 'Direct Submerged' : 'Direct Corridor'})</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  ETA: <span className="font-bold">{selectedRoute.direct_route_eta_min}m</span> | Dist: {(selectedRoute.direct_route_distance_m / 1000).toFixed(2)}km
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-[9px] text-slate-400 uppercase">Max Depth</div>
                <div className={`text-xs font-bold ${selectedRoute.direct_route_is_flooded ? 'text-rose-400' : 'text-slate-200'}`}>
                  {selectedRoute.direct_route_max_depth_cm} cm
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Depth Legend */}
      <div className="absolute bottom-6 right-4 z-10 bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl text-[11px] font-mono space-y-1.5">
        <div className="font-bold text-slate-300 mb-1">Inundation Depth Legend</div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#10b981]" />
          <span className="text-slate-400">0 – 5 cm (Passable)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="text-slate-400">5 – 15 cm (Caution)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
          <span className="text-slate-400">15 – 30 cm (Hazardous)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span className="text-slate-400">30 – 50 cm (Severe Hazard)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#a855f7]" />
          <span className="text-slate-400">&gt; 50 cm (Submerged Road)</span>
        </div>
        <div className="pt-1.5 border-t border-slate-800 flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#ec4899]" />
          <span className="text-pink-400 font-bold">Static Drain Surcharge</span>
        </div>
      </div>
    </div>
  );
};
