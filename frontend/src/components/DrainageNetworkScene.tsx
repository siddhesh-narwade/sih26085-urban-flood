import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, Waves } from 'lucide-react';
import { DrainageEdgeStatus, DrainageNodeStatus } from '../types';

interface DrainageNodeFeature {
  geometry: { coordinates: [number, number] };
  properties: { node_id: string; node_type?: string; name?: string };
}

interface DrainageEdgeFeature {
  geometry: { coordinates: [number, number][] };
  properties: { edge_id: string; diameter_mm?: number };
}

interface DrainageNetworkSceneProps {
  nodeFeatures: DrainageNodeFeature[];
  edgeFeatures: DrainageEdgeFeature[];
  nodeStats: Record<string, DrainageNodeStatus>;
  edgeStats: Record<string, DrainageEdgeStatus>;
  timeMinute: number;
  selectedConduitId: string | null;
  onConduitSelect: (edgeId: string | null) => void;
}

type NetworkSelection = { kind: 'conduit' | 'junction'; id: string } | null;

interface FlowParticle {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  progress: number;
  directionOffset: number;
}

interface ConduitObject {
  id: string;
  curve: THREE.CatmullRomCurve3;
  inner: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  particles: FlowParticle[];
  previousStatus: string;
}

interface JunctionObject {
  id: string;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  previousSurcharge: boolean;
}

const colorForConduit = (status?: DrainageEdgeStatus) => {
  if (status?.status === 'SURCHARGE' || (status?.utilization_pct ?? 0) >= 100) return 0xff4c98;
  if ((status?.utilization_pct ?? 0) >= 80) return 0xffb642;
  return 0x38dff0;
};

export const DrainageNetworkScene: React.FC<DrainageNetworkSceneProps> = ({
  nodeFeatures,
  edgeFeatures,
  nodeStats,
  edgeStats,
  timeMinute,
  selectedConduitId,
  onConduitSelect
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const nodeStatsRef = useRef(nodeStats);
  const edgeStatsRef = useRef(edgeStats);
  const selectionRef = useRef<NetworkSelection>(null);
  const onConduitSelectRef = useRef(onConduitSelect);
  const flowEnabledRef = useRef(true);
  const [selection, setSelection] = useState<NetworkSelection>(null);
  const [flowEnabled, setFlowEnabled] = useState(true);
  const [sceneAvailable, setSceneAvailable] = useState(true);

  useEffect(() => {
    nodeStatsRef.current = nodeStats;
    edgeStatsRef.current = edgeStats;
  }, [nodeStats, edgeStats]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    onConduitSelectRef.current = onConduitSelect;
  }, [onConduitSelect]);

  useEffect(() => {
    setSelection((current) => {
      if (selectedConduitId) return { kind: 'conduit', id: selectedConduitId };
      return current?.kind === 'conduit' ? null : current;
    });
  }, [selectedConduitId]);

  useEffect(() => {
    flowEnabledRef.current = flowEnabled;
  }, [flowEnabled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setSceneAvailable(false);
      return;
    }

    setSceneAvailable(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setClearColor(0x07111e, 0);
    renderer.domElement.className = 'drainage-network-canvas';
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D stormwater drainage network');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 180);
    const coordinateList = nodeFeatures.map((feature) => feature.geometry.coordinates).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const fallbackCoordinates: [number, number][] = [[72.875, 19.072], [72.88, 19.076]];
    const sourceCoordinates = coordinateList.length ? coordinateList : fallbackCoordinates;
    const longitudes = sourceCoordinates.map(([longitude]) => longitude);
    const latitudes = sourceCoordinates.map(([, latitude]) => latitude);
    const centerLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
    const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const longitudeScale = Math.cos(THREE.MathUtils.degToRad(centerLatitude));
    const spanMeters = Math.max(
      (Math.max(...longitudes) - Math.min(...longitudes)) * 111320 * longitudeScale,
      (Math.max(...latitudes) - Math.min(...latitudes)) * 111320,
      300
    );
    const worldScale = 25 / spanMeters;
    const toWorldPoint = ([longitude, latitude]: [number, number], height: number) => new THREE.Vector3(
      (longitude - centerLongitude) * 111320 * longitudeScale * worldScale,
      height,
      -(latitude - centerLatitude) * 111320 * worldScale
    );

    const maxHorizontalSpan = Math.max(
      (Math.max(...longitudes) - Math.min(...longitudes)) * 111320 * longitudeScale * worldScale,
      (Math.max(...latitudes) - Math.min(...latitudes)) * 111320 * worldScale,
      8
    );
    const gridSize = Math.max(30, maxHorizontalSpan * 1.55);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ambient = new THREE.HemisphereLight(0x9eeeff, 0x071321, 2.15);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xd7fbff, 2.2);
    keyLight.position.set(-8, 15, 9);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0x11d9f4, 45, gridSize * 1.2, 2);
    accentLight.position.set(0, 5, 0);
    scene.add(accentLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(gridSize * 0.55, 72),
      new THREE.MeshBasicMaterial({ color: 0x092137, transparent: true, opacity: 0.34, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.72;
    scene.add(ground);

    const grid = new THREE.GridHelper(gridSize, 32, 0x1a5671, 0x123149);
    grid.position.y = -1.68;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.48;
    });
    scene.add(grid);

    const edgeObjects: ConduitObject[] = [];
    const nodeObjects: JunctionObject[] = [];
    const pickTargets: THREE.Object3D[] = [];
    const commonNodeGeometry = new THREE.SphereGeometry(0.19, 20, 16);
    const commonHaloGeometry = new THREE.TorusGeometry(0.31, 0.022, 8, 40);
    const commonParticleGeometry = new THREE.SphereGeometry(0.065, 12, 10);
    const postGeometry = new THREE.CylinderGeometry(0.018, 0.043, 1.18, 8);
    const disposedGeometries = new Set<THREE.BufferGeometry>([
      commonNodeGeometry,
      commonHaloGeometry,
      commonParticleGeometry,
      postGeometry
    ]);

    nodeFeatures.forEach((feature) => {
      const nodeId = feature.properties.node_id;
      const point = toWorldPoint(feature.geometry.coordinates, 0.12);
      const postMaterial = new THREE.MeshStandardMaterial({ color: 0x24475a, metalness: 0.74, roughness: 0.28 });
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(point.x, -0.45, point.z);
      scene.add(post);

      const initialStatus = nodeStatsRef.current[nodeId];
      const initialColor = initialStatus?.is_surcharged ? 0xff4c98 : feature.properties.node_type === 'outfall' ? 0x9d91ff : 0x43e6f5;
      const nodeMaterial = new THREE.MeshStandardMaterial({
        color: initialColor,
        emissive: initialColor,
        emissiveIntensity: initialStatus?.is_surcharged ? 1.25 : 0.6,
        metalness: 0.18,
        roughness: 0.22
      });
      const nodeMesh = new THREE.Mesh(commonNodeGeometry, nodeMaterial);
      nodeMesh.position.copy(point);
      nodeMesh.userData = { kind: 'junction', id: nodeId };
      scene.add(nodeMesh);
      pickTargets.push(nodeMesh);

      const haloMaterial = new THREE.MeshBasicMaterial({ color: initialColor, transparent: true, opacity: initialStatus?.is_surcharged ? 0.86 : 0.4 });
      const halo = new THREE.Mesh(commonHaloGeometry, haloMaterial);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(point.x, -1.12, point.z);
      scene.add(halo);
      nodeObjects.push({ id: nodeId, mesh: nodeMesh, halo, previousSurcharge: Boolean(initialStatus?.is_surcharged) });
    });

    edgeFeatures.forEach((feature) => {
      const edgeId = feature.properties.edge_id;
      const coordinates = feature.geometry.coordinates.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (coordinates.length < 2) return;

      const points = coordinates.map((coordinate, pointIndex) => {
        const wave = Math.sin((pointIndex / Math.max(1, coordinates.length - 1)) * Math.PI) * 0.22;
        return toWorldPoint(coordinate, -0.92 + wave);
      });
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      const state = edgeStatsRef.current[edgeId];
      const color = colorForConduit(state);
      const radius = 0.045 + Math.min(feature.properties.diameter_mm ?? 900, 1800) / 1800 * 0.075;
      const segments = Math.max(24, coordinates.length * 7);
      const casingGeometry = new THREE.TubeGeometry(curve, segments, radius * 1.42, 8, false);
      const casingMaterial = new THREE.MeshStandardMaterial({ color: 0x174257, metalness: 0.82, roughness: 0.24, transparent: true, opacity: 0.34, depthWrite: false });
      const casing = new THREE.Mesh(casingGeometry, casingMaterial);
      scene.add(casing);
      disposedGeometries.add(casingGeometry);

      const innerGeometry = new THREE.TubeGeometry(curve, segments, radius, 7, false);
      const innerMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, metalness: 0.22, roughness: 0.28 });
      const inner = new THREE.Mesh(innerGeometry, innerMaterial);
      inner.userData = { kind: 'conduit', id: edgeId };
      scene.add(inner);
      disposedGeometries.add(innerGeometry);

      const hitGeometry = new THREE.TubeGeometry(curve, segments, Math.max(radius * 3, 0.24), 7, false);
      const hitTarget = new THREE.Mesh(hitGeometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      hitTarget.userData = { kind: 'conduit', id: edgeId };
      scene.add(hitTarget);
      pickTargets.push(inner, hitTarget);

      const particles: FlowParticle[] = [];
      for (let particleIndex = 0; particleIndex < 2; particleIndex += 1) {
        const particleMaterial = new THREE.MeshBasicMaterial({ color: colorForConduit(state), toneMapped: false });
        const particleMesh = new THREE.Mesh(commonParticleGeometry, particleMaterial);
        particleMesh.userData = { kind: 'conduit', id: edgeId };
        particleMesh.position.copy(curve.getPointAt(particleIndex * 0.5));
        scene.add(particleMesh);
        particles.push({ mesh: particleMesh, progress: particleIndex * 0.5, directionOffset: particleIndex % 2 === 0 ? 1 : -1 });
      }

      edgeObjects.push({ id: edgeId, curve, inner, particles, previousStatus: state?.status ?? '' });
    });

    camera.position.set(0, Math.max(15, gridSize * 0.58), gridSize * 0.78);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.35, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 12;
    controls.maxDistance = 70;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.22;
    controls.update();
    controlsRef.current = controls;
    cameraRef.current = camera;

    const raycaster = new THREE.Raycaster();
    const normalizedPointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    const updateRaycast = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      normalizedPointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      normalizedPointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(normalizedPointer, camera);
      return raycaster.intersectObjects(pickTargets, false)[0]?.object.userData as NetworkSelection extends infer T ? { kind: 'conduit' | 'junction'; id: string } | undefined : never;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const hit = updateRaycast(event);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) {
        pointerDown = null;
        return;
      }
      const hit = updateRaycast(event);
      setSelection(hit ? { kind: hit.kind, id: hit.id } : null);
      onConduitSelectRef.current(hit?.kind === 'conduit' ? hit.id : null);
      pointerDown = null;
    };
    const handlePointerLeave = () => {
      pointerDown = null;
      renderer.domElement.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    renderer.domElement.addEventListener('pointerdown', handlePointerDown, { passive: true });
    renderer.domElement.addEventListener('pointerup', handlePointerUp, { passive: true });
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    const resizeRenderer = () => {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(host);
    window.addEventListener('resize', resizeRenderer, { passive: true });
    resizeRenderer();
    renderer.render(scene, camera);

    let lastFrameTime = 0;
    let frameId = 0;
    const renderFrame = (time: number) => {
      frameId = window.requestAnimationFrame(renderFrame);
      const delta = Math.min((time - (lastFrameTime || time)) / 1000, 0.05);
      lastFrameTime = time;
      controls.update();

      edgeObjects.forEach((edge) => {
        const status = edgeStatsRef.current[edge.id];
        const color = colorForConduit(status);
        const statusKey = `${status?.status ?? 'NORMAL'}:${Math.round(status?.utilization_pct ?? 0)}`;
        if (statusKey !== edge.previousStatus) {
          edge.inner.material.color.setHex(color);
          edge.inner.material.emissive.setHex(color);
          edge.particles.forEach((particle) => particle.mesh.material.color.setHex(color));
          edge.previousStatus = statusKey;
        }
        edge.inner.material.emissiveIntensity = selectionRef.current?.kind === 'conduit' && selectionRef.current.id === edge.id
          ? 1.65
          : 0.8 + Math.min(status?.utilization_pct ?? 0, 120) / 260;
        const direction = status?.status === 'SURCHARGE' ? -1 : 1;
        const speed = (0.035 + Math.min(status?.utilization_pct ?? 0, 120) / 1500) * direction;
        edge.particles.forEach((particle) => {
          particle.mesh.visible = flowEnabledRef.current && (status?.flow_m3s ?? 0) > 0;
          particle.progress = (particle.progress + delta * speed * particle.directionOffset + 1) % 1;
          particle.mesh.position.copy(edge.curve.getPointAt(particle.progress));
          const pulse = 1 + Math.sin(time * 0.006 + particle.progress * Math.PI * 2) * 0.2;
          particle.mesh.scale.setScalar(pulse);
        });
      });

      nodeObjects.forEach((node) => {
        const state = nodeStatsRef.current[node.id];
        const surcharged = Boolean(state?.is_surcharged);
        const selected = selectionRef.current?.kind === 'junction' && selectionRef.current.id === node.id;
        const color = surcharged ? 0xff4c98 : selected ? 0x8df7ff : 0x43e6f5;
        if (surcharged !== node.previousSurcharge) {
          node.mesh.material.color.setHex(color);
          node.mesh.material.emissive.setHex(color);
          node.halo.material.color.setHex(color);
          node.previousSurcharge = surcharged;
        }
        const pulse = surcharged ? 1 + Math.sin(time * 0.004) * 0.14 : selected ? 1.18 : 1;
        node.mesh.scale.setScalar(pulse);
        node.mesh.material.emissiveIntensity = surcharged ? 1.45 : selected ? 1.2 : 0.56;
        node.halo.material.opacity = surcharged ? 0.72 + Math.sin(time * 0.004) * 0.18 : selected ? 0.76 : 0.32;
      });

      renderer.render(scene, camera);
    };
    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeRenderer);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (!disposedGeometries.has(object.geometry)) object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      disposedGeometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [nodeFeatures, edgeFeatures]);

  const selectedEdge = selection?.kind === 'conduit' ? edgeStats[selection.id] : undefined;
  const selectedNode = selection?.kind === 'junction' ? nodeStats[selection.id] : undefined;
  const selectedNodeFeature = selection?.kind === 'junction'
    ? nodeFeatures.find((feature) => feature.properties.node_id === selection.id)
    : undefined;

  return (
    <section className="drainage-scene-shell" aria-label="Interactive 3D stormwater network">
      <div ref={hostRef} className="drainage-scene-viewport" />
      {!sceneAvailable && <div className="drainage-scene-fallback">3D rendering unavailable · hydraulic telemetry remains below</div>}
      <div className="drainage-scene-heading">
        <span className="drainage-scene-live"><i /> NETWORK LIVE</span>
        <span className="drainage-scene-title">STORMWATER CONDUIT MODEL</span>
        <span className="drainage-scene-time">T+{timeMinute} MIN</span>
      </div>
      <div className="drainage-scene-actions">
        <button
          type="button"
          className={`drainage-scene-action ${flowEnabled ? 'is-active' : ''}`}
          aria-label={flowEnabled ? 'Pause flow particles' : 'Resume flow particles'}
          aria-pressed={flowEnabled}
          title={flowEnabled ? 'Pause flow particles' : 'Resume flow particles'}
          onClick={() => setFlowEnabled((enabled) => !enabled)}
        >
          <Waves className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="drainage-scene-action"
          aria-label="Reset network camera"
          title="Reset network camera"
          onClick={() => {
            cameraRef.current?.position.set(0, 18, 29);
            controlsRef.current?.target.set(0, -0.35, 0);
            controlsRef.current?.update();
          }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      <div className="drainage-scene-legend" aria-label="Hydraulic status legend">
        <span><i className="legend-flow" />FLOWING</span>
        <span><i className="legend-warning" />HIGH LOAD</span>
        <span><i className="legend-surcharge" />SURCHARGE</span>
      </div>
      <div className="drainage-scene-selection" aria-live="polite">
        {selectedEdge ? (
          <><span>CONDUIT / {selectedEdge.edge_id}</span><strong>{selectedEdge.flow_m3s} m³/s</strong><i>{selectedEdge.utilization_pct}% LOAD</i></>
        ) : selectedNode ? (
          <><span>JUNCTION / {selectedNode.node_id}</span><strong>{selectedNode.inflow_m3s} m³/s IN</strong><i>{selectedNode.is_surcharged ? `${selectedNode.surcharge_m3s} m³/s BACKFLOW` : `${selectedNode.outflow_m3s} m³/s OUT`}</i></>
        ) : (
          <><span>NETWORK TELEMETRY</span><strong>{edgeFeatures.length} CONDUITS</strong><i>{nodeFeatures.length} JUNCTIONS</i></>
        )}
        {selectedNodeFeature?.properties.name && <em>{selectedNodeFeature.properties.name}</em>}
      </div>
    </section>
  );
};