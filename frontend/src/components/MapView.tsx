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

interface MapViewProps {
  roadsGeoJSON: any;
  drainageNodesGeoJSON: any;
  drainageEdgesGeoJSON: any;
  poisGeoJSON: any;
  simulation: SimulationResult | null;
  currentStepIndex: number;
  selectedRoute: RoutePlanResponse | null;
  onSelectRoad: (roadId: string) => void;
  onSelectDrainageNode: (nodeId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  roadsGeoJSON,
  drainageNodesGeoJSON,
  drainageEdgesGeoJSON,
  poisGeoJSON,
  simulation,
  currentStepIndex,
  selectedRoute,
  onSelectRoad,
  onSelectDrainageNode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups refs
  const roadsLayerRef = useRef<L.GeoJSON | null>(null);
  const drainagePipesLayerRef = useRef<L.GeoJSON | null>(null);
  const drainageNodesLayerRef = useRef<L.GeoJSON | null>(null);
  const poisLayerRef = useRef<L.LayerGroup | null>(null);
  const radarLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Layer visibility state
  const [showStreets, setShowStreets] = useState<boolean>(true);
  const [showDrainage, setShowDrainage] = useState<boolean>(true);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showPOIs, setShowPOIs] = useState<boolean>(true);
  const [showRoute, setShowRoute] = useState<boolean>(true);

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
    if (isSurcharged || utilPct >= 100.0) return '#ec4899'; // Pulsing Magenta Surcharge
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
      zoomControl: false,
      attributionControl: false
    });

    // Dark Matter Tactical Basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups
    poisLayerRef.current = L.layerGroup().addTo(map);
    radarLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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
            ${surch > 0 ? `<div class="text-pink-400 font-bold animate-pulse">⚠️ Drain Surcharge: ${surch} m³/s</div>` : ''}
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
    if (!mapInstanceRef.current) return;

    if (drainagePipesLayerRef.current) drainagePipesLayerRef.current.remove();
    if (drainageNodesLayerRef.current) drainageNodesLayerRef.current.remove();

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

    // Drainage Nodes (Manholes & Inlets)
    if (drainageNodesGeoJSON) {
      const nodesLayer = L.geoJSON(drainageNodesGeoJSON, {
        pointToLayer: (feature, latlng) => {
          const nodeId = feature.properties.node_id;
          const stat = nodeState[nodeId];
          const isSurch = stat ? stat.is_surcharged : false;
          const nodeType = feature.properties.node_type;

          let markerColor = '#38bdf8';
          if (nodeType === 'outfall') markerColor = '#818cf8';
          if (isSurch) markerColor = '#ec4899';

          const marker = L.circleMarker(latlng, {
            radius: isSurch ? 9 : 6,
            fillColor: markerColor,
            color: isSurch ? '#ffffff' : '#0f172a',
            weight: isSurch ? 2.5 : 1.5,
            opacity: 1,
            fillOpacity: 0.9,
            className: isSurch ? 'surcharge-pulse-icon' : ''
          });

          marker.bindTooltip(
            `<div class="p-1 font-mono text-xs">
              <div class="font-bold ${isSurch ? 'text-pink-400' : 'text-sky-300'}">${feature.properties.name}</div>
              <div>Type: ${nodeType.toUpperCase()}</div>
              ${isSurch ? `<div class="text-pink-400 font-bold animate-pulse">⚠️ SURCHARGE: ${stat?.surcharge_m3s} m³/s Backflow</div>` : '<div>Status: Normal Conveyance</div>'}
            </div>`
          );

          marker.on('click', () => {
            onSelectDrainageNode(nodeId);
          });

          return marker;
        }
      }).addTo(mapInstanceRef.current);
      drainageNodesLayerRef.current = nodesLayer;
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

  // 5. Render Moving Storm Radar Overlay
  useEffect(() => {
    if (!mapInstanceRef.current || !radarLayerRef.current) return;

    radarLayerRef.current.clearLayers();

    if (!showRadar || !currentStep?.storm_center) return;

    const [stormLat, stormLon] = currentStep.storm_center;
    const peakRain = currentStep.current_rainfall_peak_mmh || 0;

    if (peakRain > 5.0) {
      const stormRadiusM = Math.min(3000, Math.max(1200, peakRain * 22));

      const radarCircle = L.circle([stormLat, stormLon], {
        radius: stormRadiusM,
        fillColor: '#0ea5e9',
        fillOpacity: 0.18,
        color: '#38bdf8',
        weight: 1.5,
        dashArray: '4, 6'
      });

      const epicenterCircle = L.circleMarker([stormLat, stormLon], {
        radius: 12,
        fillColor: '#38bdf8',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.7
      });

      radarCircle.bindTooltip(
        `<div class="p-1 font-mono text-xs text-sky-300 font-bold">
          🌧️ Mesoscale Convective Storm Core: ${peakRain} mm/hr
        </div>`,
        { sticky: true }
      );

      radarLayerRef.current.addLayer(radarCircle);
      radarLayerRef.current.addLayer(epicenterCircle);
    }
  }, [currentStep, showRadar]);

  // 6. Render Active Routing Overlay
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    if (!showRoute || !selectedRoute) return;

    // 1. Direct Route (if flooded, show as red dashed line)
    if (selectedRoute.direct_route_segments && selectedRoute.direct_route_segments.length > 0) {
      const directCoords: [number, number][] = [];
      selectedRoute.direct_route_segments.forEach((seg) => {
        seg.coordinates.forEach(([lon, lat]) => directCoords.push([lat, lon]));
      });

      const directLine = L.polyline(directCoords, {
        color: selectedRoute.direct_route_is_flooded ? '#ef4444' : '#64748b',
        weight: 4,
        dashArray: selectedRoute.direct_route_is_flooded ? '8, 8' : undefined,
        opacity: 0.75
      });
      directLine.bindTooltip(`Direct Path (${selectedRoute.direct_route_distance_m}m) - Max Flood: ${selectedRoute.direct_route_max_depth_cm}cm`);
      routeLayerRef.current.addLayer(directLine);
    }

    // 2. Safe Flood-Avoidance Route (Green solid line with glow)
    if (selectedRoute.safe_route_found && selectedRoute.safe_route_segments) {
      const safeCoords: [number, number][] = [];
      selectedRoute.safe_route_segments.forEach((seg) => {
        seg.coordinates.forEach(([lon, lat]) => safeCoords.push([lat, lon]));
      });

      const safeLine = L.polyline(safeCoords, {
        color: '#10b981',
        weight: 6,
        opacity: 0.95
      });
      safeLine.bindTooltip(`🛡️ Safe Emergency Route (${selectedRoute.safe_route_distance_m}m, ETA: ${selectedRoute.safe_route_eta_min}m)`);
      routeLayerRef.current.addLayer(safeLine);
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
            <span>Precipitation Radar Core</span>
          </span>
          <input
            type="checkbox"
            checked={showRadar}
            onChange={(e) => setShowRadar(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
          />
        </label>

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
      </div>

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
          <div className="w-3 h-3 rounded-full bg-[#ec4899] animate-ping" />
          <span className="text-pink-400 font-bold">Drainage Surcharge</span>
        </div>
      </div>
    </div>
  );
};
