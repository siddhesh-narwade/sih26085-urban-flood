import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DataLayerMetadata } from '../types';

export type ProvenanceTier = 'REAL' | 'DERIVED' | 'SIMULATED';

interface ProvenanceScene3DProps {
  layers: DataLayerMetadata[];
  activeTier: ProvenanceTier | null;
  onSelectTier: (tier: ProvenanceTier) => void;
}

interface TierNode {
  tier: ProvenanceTier;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>;
  orbit: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  layers: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[];
  particles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  previousSelected: boolean;
}

const tierConfig: Array<{ tier: ProvenanceTier; label: string; color: number; position: THREE.Vector3 }> = [
  { tier: 'REAL', label: 'TIER A / REAL', color: 0x35edbb, position: new THREE.Vector3(-4.2, 0.6, 0.5) },
  { tier: 'DERIVED', label: 'TIER B / DERIVED', color: 0x55dfff, position: new THREE.Vector3(0, 2.5, -1.3) },
  { tier: 'SIMULATED', label: 'TIER C / SIMULATED', color: 0xffb648, position: new THREE.Vector3(4.2, 0.6, 0.5) }
];

const getTier = (classification: string): ProvenanceTier => {
  if (classification.startsWith('REAL')) return 'REAL';
  if (classification.startsWith('DERIVED')) return 'DERIVED';
  return 'SIMULATED';
};

export const ProvenanceScene3D: React.FC<ProvenanceScene3DProps> = ({ layers, activeTier, onSelectTier }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeTierRef = useRef(activeTier);
  const onSelectTierRef = useRef(onSelectTier);

  useEffect(() => {
    activeTierRef.current = activeTier;
  }, [activeTier]);

  useEffect(() => {
    onSelectTierRef.current = onSelectTier;
  }, [onSelectTier]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x06111f, 0);
    renderer.domElement.className = 'provenance-scene-canvas';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D scientific data provenance constellation');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
    camera.position.set(0, 8.5, 15.5);

    scene.add(new THREE.HemisphereLight(0xc9f9ff, 0x0a1322, 2));
    const keyLight = new THREE.DirectionalLight(0xe4fcff, 2.3);
    keyLight.position.set(-5, 10, 8);
    scene.add(keyLight);
    const coreLight = new THREE.PointLight(0x60eaff, 40, 25, 2);
    coreLight.position.set(0, 2.5, 0);
    scene.add(coreLight);

    const ground = new THREE.GridHelper(20, 26, 0x23617c, 0x15344a);
    ground.position.y = -2.3;
    const groundMaterials = Array.isArray(ground.material) ? ground.material : [ground.material];
    groundMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.32;
    });
    scene.add(ground);

    const coreGroup = new THREE.Group();
    scene.add(coreGroup);
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(1.14, 1.14, 1.14),
      new THREE.MeshPhysicalMaterial({ color: 0xafeaff, emissive: 0x1b7baf, emissiveIntensity: 0.54, metalness: 0.82, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.12 })
    );
    core.rotation.set(0.24, Math.PI * 0.25, 0.12);
    coreGroup.add(core);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.025, 10, 84), new THREE.MeshBasicMaterial({ color: 0x76eaff, transparent: true, opacity: 0.7 }));
    coreRing.rotation.x = Math.PI * 0.34;
    coreGroup.add(coreRing);
    const coreRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.012, 8, 84), new THREE.MeshBasicMaterial({ color: 0x48d7ed, transparent: true, opacity: 0.4 }));
    coreRing2.rotation.set(Math.PI * 0.62, 0.2, -0.24);
    coreGroup.add(coreRing2);

    const nodeGeometry = new THREE.BoxGeometry(1.28, 0.24, 0.94);
    const deckGeometry = new THREE.CylinderGeometry(0.88, 1.02, 0.17, 8, 1);
    const orbitGeometry = new THREE.TorusGeometry(1.12, 0.016, 8, 72);
    const sparkGeometry = new THREE.SphereGeometry(0.055, 10, 8);
    const tierNodes: TierNode[] = [];
    const raycastTargets: THREE.Object3D[] = [];
    const curves: Array<{ tier: ProvenanceTier; curve: THREE.CatmullRomCurve3; line: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>; color: number }> = [];
    const particles: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; progress: number; tier: ProvenanceTier }> = [];
    const geometries = new Set<THREE.BufferGeometry>([nodeGeometry, deckGeometry, orbitGeometry, sparkGeometry]);

    tierConfig.forEach(({ tier, color, position }) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(position.x * 0.4, position.y + 0.45, position.z * 0.7),
        position
      ]);
      const curveGeometry = new THREE.TubeGeometry(curve, 42, 0.018, 6, false);
      const curveMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
      const line = new THREE.Mesh(curveGeometry, curveMaterial);
      scene.add(line);
      geometries.add(curveGeometry);
      curves.push({ tier, curve, line, color });

      const recordCount = layers.filter((layer) => getTier(layer.classification) === tier).length;
      const layerCount = Math.max(2, Math.min(5, recordCount + 1));
      const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x101f2d, metalness: 0.88, roughness: 0.24, emissive: color, emissiveIntensity: 0.11 });
      const deck = new THREE.Mesh(deckGeometry, deckMaterial);
      deck.position.set(position.x, position.y - 0.58, position.z);
      scene.add(deck);

      const dataLayers: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        const plateGeometry = new THREE.BoxGeometry(1.13 - layerIndex * 0.075, 0.095, 0.77 - layerIndex * 0.05);
        const plateMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, metalness: 0.7, roughness: 0.27, transparent: true, opacity: 0.82 });
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        plate.position.set(position.x + (layerIndex % 2 === 0 ? -0.035 : 0.035), position.y - 0.46 + layerIndex * 0.135, position.z);
        plate.rotation.y = (layerIndex % 2 === 0 ? -1 : 1) * 0.035;
        scene.add(plate);
        dataLayers.push(plate);
        geometries.add(plateGeometry);
      }

      const mesh = new THREE.Mesh(nodeGeometry, new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.84, metalness: 0.48, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.16 }));
      mesh.position.set(position.x, position.y + 0.15, position.z);
      mesh.userData = { tier };
      scene.add(mesh);
      raycastTargets.push(mesh);

      const orbit = new THREE.Mesh(orbitGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.44 }));
      orbit.position.set(position.x, position.y - 0.45, position.z);
      orbit.rotation.set(Math.PI * 0.5, 0.15, 0.1);
      scene.add(orbit);

      const nodeParticles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
      for (let index = 0; index < 4; index += 1) {
        const particle = new THREE.Mesh(sparkGeometry, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
        scene.add(particle);
        nodeParticles.push(particle);
        particles.push({ mesh: particle, curve, progress: index / 4, tier });
      }

      tierNodes.push({ tier, mesh, orbit, layers: dataLayers, particles: nodeParticles, previousSelected: activeTierRef.current === tier });
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 9;
    controls.maxDistance = 25;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.28;
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const updateHit = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(raycastTargets, false)[0]?.object.userData.tier as ProvenanceTier | undefined;
    };
    const handlePointerMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = updateHit(event) ? 'pointer' : 'grab';
    };
    const handlePointerUp = (event: PointerEvent) => {
      const tier = updateHit(event);
      if (tier) onSelectTierRef.current(tier);
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    renderer.domElement.addEventListener('click', handlePointerUp, { passive: true });

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

    let frameId = 0;
    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate);
      if (!reducedMotion) {
        core.rotation.y = time * 0.00018;
        coreRing.rotation.z = time * 0.00012;
        coreRing2.rotation.y = -time * 0.0001;
      }
      controls.update();

      tierNodes.forEach((node, index) => {
        const selected = activeTierRef.current === node.tier;
        const selectedScale = reducedMotion ? 1.1 : 1.15 + Math.sin(time * 0.004) * 0.035;
        const idleScale = reducedMotion ? 1 : 1 + Math.sin(time * 0.0015 + index) * 0.018;
        node.mesh.scale.setScalar(selected ? selectedScale : idleScale);
        node.mesh.material.emissiveIntensity = selected ? 1.25 : 0.58;
        node.orbit.material.opacity = selected ? 0.95 : 0.48;
        node.layers.forEach((layer) => { layer.material.emissiveIntensity = selected ? 0.42 : 0.1; });
        if (!reducedMotion) node.orbit.rotation.y = time * (0.00015 + index * 0.000025);
        node.previousSelected = selected;
      });

      curves.forEach((connection) => {
        connection.line.material.opacity = activeTierRef.current && activeTierRef.current !== connection.tier ? 0.13 : 0.46;
      });

      particles.forEach((particle) => {
        if (!reducedMotion) particle.progress = (particle.progress + 0.0018) % 1;
        particle.mesh.visible = !activeTierRef.current || activeTierRef.current === particle.tier;
        particle.mesh.position.copy(particle.curve.getPointAt(particle.progress));
      });

      renderer.render(scene, camera);
    };
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeRenderer);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerUp);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (!geometries.has(object.geometry)) object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const tierCounts = layers.reduce<Record<ProvenanceTier, number>>((counts, layer) => {
    counts[getTier(layer.classification)] += 1;
    return counts;
  }, { REAL: 0, DERIVED: 0, SIMULATED: 0 });

  return (
    <section className="provenance-scene" aria-label="Interactive scientific data provenance tiers">
      <div ref={hostRef} className="provenance-scene-canvas-host" />
      <div className="provenance-scene-heading"><span>DATA LINEAGE / 3D VIEW</span><i /> <span>{layers.length} REGISTERED LAYERS</span></div>
      <div className="provenance-scene-core-label">SOURCE CORE<span>PROVENANCE GRAPH</span></div>
      <div className="provenance-tier-controls">
        <button type="button" className={`provenance-tier-control provenance-tier-real ${activeTier === 'REAL' ? 'is-selected' : ''}`} aria-pressed={activeTier === 'REAL'} onClick={() => onSelectTier('REAL')}>
          <i /><span>TIER A / REAL</span><strong>{tierCounts.REAL}</strong>
        </button>
        <button type="button" className={`provenance-tier-control provenance-tier-derived ${activeTier === 'DERIVED' ? 'is-selected' : ''}`} aria-pressed={activeTier === 'DERIVED'} onClick={() => onSelectTier('DERIVED')}>
          <i /><span>TIER B / DERIVED</span><strong>{tierCounts.DERIVED}</strong>
        </button>
        <button type="button" className={`provenance-tier-control provenance-tier-simulated ${activeTier === 'SIMULATED' ? 'is-selected' : ''}`} aria-pressed={activeTier === 'SIMULATED'} onClick={() => onSelectTier('SIMULATED')}>
          <i /><span>TIER C / SIMULATION</span><strong>{tierCounts.SIMULATED}</strong>
        </button>
      </div>
      <span className="provenance-scene-hint">DRAG TO ORBIT · SELECT A TIER TO FILTER THE REGISTRY</span>
    </section>
  );
};