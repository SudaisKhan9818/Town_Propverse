'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Canvas, useThree, type ThreeEvent, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { getTownData } from '@/src/features/town/data/layout-engine';
import { STREET_LIGHTS } from '@/src/features/town/data/streetlights';
import { WAPDA_GRID_POS } from '@/src/features/town/config/townLayout';
import type { TwinHistoryData, TwinLiveData } from './useTwinIoT';
import type { TwinHealthStatus, TwinReading } from './iotMqttMock';
import { calculateRisk, getHealthStatus, isReadingOn, type AutoHealResult } from './twinPredictor';

export type SectionName = 'ALL' | 'R-1' | 'R-2' | 'R-3' | 'R-4' | 'Main' | 'Park';

export type TwinPole = {
  id: string;
  x: number;
  z: number;
  section: SectionName;
  roadId: string;
};

const POLE_HEIGHT = 4;
const TOWN = getTownData();

function sectionForRoad(roadId: string): SectionName {
  if (roadId === 'street-1') return 'R-1';
  if (roadId === 'street-2') return 'R-2';
  if (roadId === 'civic-road-1') return 'R-3';
  if (roadId === 'civic-road-2' || roadId === 'school-hospital-road') return 'R-4';
  return 'Main';
}

/** The first 60 Twin IDs are the exact first 60 positions used by Real Town. */
export function generatePolePositions(): TwinPole[] {
  return STREET_LIGHTS.slice(0, 60).map((light, index) => ({
    id: `P-${String(index + 1).padStart(2, '0')}`,
    x: light.x,
    z: light.z,
    section: sectionForRoad(light.roadId),
    roadId: light.roadId,
  }));
}

export const TWIN_POLES: TwinPole[] = generatePolePositions();

export type TwinBlueprintViewProps = {
  liveData: TwinLiveData;
  historyData?: TwinHistoryData;
  logs?: string[];
  selectedPole: string | null;
  sectionFilter?: SectionName;
  onSelectPole: (poleId: string) => void;
  onTogglePole: (poleId: string) => void;
  onDimPole: (poleId: string) => void;
  onAutoHeal?: () => AutoHealResult;
  presentationMode?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

function defaultReading(poleId: string): TwinReading {
  return {
    poleId,
    isLightOn: true,
    isOn: true,
    voltage: 220,
    temp: 48,
    watt: 85,
    baseWatt: 85,
    risk: 0.1,
    healthStatus: 'OK',
    timestamp: 0,
  };
}

type AnimationSubscriber = (elapsed: number, delta: number) => void;
type AnimationContextValue = { register: (subscriber: AnimationSubscriber) => () => void };
const AnimationContext = createContext<AnimationContextValue | null>(null);

function useTwinAnimation(subscriber: AnimationSubscriber) {
  const animation = useContext(AnimationContext);
  useEffect(() => animation?.register(subscriber), [animation, subscriber]);
}

function TwinAnimationClock({ children }: { children: ReactNode }) {
  const { invalidate } = useThree();
  const subscribers = useRef(new Set<AnimationSubscriber>());
  const register = useCallback((subscriber: AnimationSubscriber) => {
    subscribers.current.add(subscriber);
    return () => subscribers.current.delete(subscriber);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      accumulator += delta;
      if (!document.hidden && accumulator >= 1 / 30) {
        subscribers.current.forEach((subscriber) => subscriber(now / 1000, accumulator));
        accumulator = 0;
        invalidate();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [invalidate]);

  const value = useMemo(() => ({ register }), [register]);
  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
}

type HologramBuilding = { id: string; x: number; z: number; width: number; depth: number; height: number };

function HoloBuildings() {
  const buildings = useMemo<HologramBuilding[]>(() => {
    const plots = TOWN.plots.map((plot, index) => ({
      id: plot.id,
      x: plot.position.x,
      z: plot.position.z,
      width: Math.max(2, plot.bounds.w - 0.4),
      depth: Math.max(2, plot.bounds.d - 0.4),
      height: 3 + (index % 4) * 0.8,
    }));
    const amenities = TOWN.amenities.map((item, index) => ({
      id: item.id,
      x: item.position.x,
      z: item.position.z,
      width: item.bounds.w,
      depth: item.bounds.d,
      height: 4.2 + (index % 2),
    }));
    const civic = TOWN.civic.filter((item) => item.type !== 'wapda').map((item, index) => ({
      id: item.id,
      x: item.position.x,
      z: item.position.z,
      width: item.bounds.w,
      depth: item.bounds.d,
      height: 4.5 + (index % 3),
    }));
    return [...plots, ...amenities, ...civic];
  }, []);
  const buildingRef = useRef<THREE.InstancedMesh>(null);
  const floorRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const floorGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float edge = 1.0 - smoothstep(0.015, 0.09, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        float scan = smoothstep(0.02, 0.0, abs(fract(vUv.y * 7.0 + uTime * 0.35) - 0.5));
        float alpha = 0.02 + edge * 0.22 + scan * 0.045;
        gl_FragColor = vec4(0.0, 0.83, 1.0, alpha);
      }
    `,
  }), []);
  const floorMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#00D4FF', transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    const matrix = new THREE.Matrix4();
    buildings.forEach((building, index) => {
      matrix.compose(
        new THREE.Vector3(building.x, building.height / 2, building.z),
        new THREE.Quaternion(),
        new THREE.Vector3(building.width, building.height, building.depth),
      );
      buildingRef.current?.setMatrixAt(index, matrix);
      matrix.compose(
        new THREE.Vector3(building.x, 0.04, building.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
        new THREE.Vector3(building.width, building.depth, 1),
      );
      floorRef.current?.setMatrixAt(index, matrix);
    });
    if (buildingRef.current) buildingRef.current.instanceMatrix.needsUpdate = true;
    if (floorRef.current) floorRef.current.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  const animate = useCallback((elapsed: number) => {
    material.uniforms.uTime.value = elapsed;
  }, [material]);
  useTwinAnimation(animate);

  return (
    <group>
      <instancedMesh ref={buildingRef} args={[geometry, material, buildings.length]} frustumCulled>
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </instancedMesh>
      <instancedMesh ref={floorRef} args={[floorGeometry, floorMaterial, buildings.length]} frustumCulled>
        <primitive object={floorGeometry} attach="geometry" />
        <primitive object={floorMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}

function HoloRoads() {
  const roads = useMemo(() => TOWN.streets.map((road) => {
    const alongX = road.orientation === 'EW';
    const half = road.length / 2;
    return {
      id: road.id,
      main: road.id === 'boulevard',
      points: (alongX
        ? [[road.position.x - half, 0.08, road.position.z], [road.position.x + half, 0.08, road.position.z]]
        : [[road.position.x, 0.08, road.position.z - half], [road.position.x, 0.08, road.position.z + half]]) as [number, number, number][],
    };
  }), []);

  return (
    <group>
      {roads.map((road) => (
        <Line key={road.id} points={road.points} color={road.main ? '#00E5FF' : '#008FC4'} lineWidth={road.main ? 2.8 : 1.1} transparent opacity={road.main ? 0.9 : 0.5} />
      ))}
    </group>
  );
}

function GridCore() {
  const ref = useRef<THREE.Mesh>(null);
  const animate = useCallback((elapsed: number) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.12);
  }, []);
  useTwinAnimation(animate);
  return (
    <mesh ref={ref} position={[0, 2.5, 0]}>
      <sphereGeometry args={[1.35, 12, 8]} />
      <meshBasicMaterial color="#00FFB3" wireframe transparent opacity={0.9} />
    </mesh>
  );
}

function WapdaGridStation({ totalWatt }: { totalWatt: number }) {
  return (
    <group position={WAPDA_GRID_POS}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[6, 5, 6]} />
        <meshBasicMaterial color="#00FFB3" wireframe transparent opacity={0.6} />
      </mesh>
      <GridCore />
      <Text position={[0, 6.2, 0]} fontSize={1.1} color="#00FFB3" anchorX="center" anchorY="middle">GRID MAIN</Text>
      <Html position={[0, 7.5, 0]} center distanceFactor={16}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-emerald-300/40 bg-black/70 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-200 backdrop-blur-xl">
          <div>GRID SUPPLY 6.0 KW</div>
          <div className="text-cyan-200">LOAD {(totalWatt / 1000).toFixed(2)} KW</div>
        </div>
      </Html>
    </group>
  );
}

function IoTFlowDiagram({ liveData, logs }: { liveData: TwinLiveData; logs?: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  const totalPoles = TWIN_POLES.length;
  const activeSensors = useMemo(() => {
    let count = 0;
    liveData.forEach((r) => { if (isReadingOn(r)) count += 1; });
    return count;
  }, [liveData]);
  const warnCount = useMemo(() => {
    let count = 0;
    liveData.forEach((r) => { if (r.healthStatus === 'WARN') count += 1; });
    return count;
  }, [liveData]);
  const failCount = useMemo(() => {
    let count = 0;
    liveData.forEach((r) => { if (r.healthStatus === 'FAIL') count += 1; });
    return count;
  }, [liveData]);
  const mqttMsgCount = logs?.length ?? 0;
  const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

  const stages = [
    { label: 'POLE SENSOR', status: activeSensors > 0 ? 'active' as const : 'idle' as const, detail: `${activeSensors}/${totalPoles} SENSING` },
    { label: 'EDGE RULES', status: (warnCount + failCount) > 0 ? 'warn' as const : 'active' as const, detail: failCount > 0 ? `${failCount} TRIGGERED` : warnCount > 0 ? `${warnCount} FLAGGED` : 'ALL CLEAR' },
    { label: 'MQTT STREAM', status: mqttMsgCount > 0 ? 'active' as const : 'idle' as const, detail: `${mqttMsgCount} MSGS` },
    { label: 'TWIN DASHBOARD', status: 'active' as const, detail: 'RENDERING' },
  ];

  const statusColor = (status: 'active' | 'warn' | 'idle') => {
    if (status === 'warn') return '#FFD166';
    if (status === 'active') return '#00FFB3';
    return '#4B5563';
  };

  return (
    <div className="pointer-events-none absolute bottom-24 left-5 z-[180] w-[min(620px,calc(100vw-2.5rem))] rounded-2xl border border-cyan-300/20 bg-[#030812]/75 p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100 shadow-[0_0_30px_rgba(0,212,255,0.12)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between text-[8px] tracking-[0.2em] text-cyan-300/70">
        <span>PROPVERSE EDGE DATA LOOP</span>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
      </div>
      <div className="flex items-center justify-between gap-1 text-center">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="min-w-0 flex-1 rounded-lg border border-cyan-300/25 bg-cyan-400/[0.06] px-2 py-2 text-[8px] text-cyan-100/90">
              <div className="flex items-center justify-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(stage.status), boxShadow: stage.status !== 'idle' ? `0 0 6px ${statusColor(stage.status)}` : 'none' }} />
                {stage.label}
              </div>
              <div className="mt-1 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <span className="text-[7px]" style={{ color: statusColor(stage.status) }}>{stage.detail}</span>
            </div>
            {index < stages.length - 1 && <span className="shrink-0 text-cyan-300/70" style={{ opacity: tick % 2 === 0 ? 1 : 0.4, transition: 'opacity 0.6s ease' }}>→</span>}
          </div>
        ))}
      </div>
      {lastLog && (
        <div className="mt-2 truncate text-center text-[7px] normal-case tracking-[0.08em] text-cyan-300/60">
          {lastLog}
        </div>
      )}
      <div className="mt-1 text-center text-[8px] tracking-[0.16em] text-cyan-300/50">SENSOR READING → LOCAL DECISION → MESSAGE BUS → VISUAL CONTROL</div>
    </div>
  );
}

function EnergyNetwork({ liveData }: { liveData: TwinLiveData }) {
  const particleRef = useRef<THREE.InstancedMesh>(null);
  const dataRef = useRef(liveData);
  const particles = useMemo(() => new THREE.SphereGeometry(0.11, 6, 4), []);
  const particleMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00F0FF', transparent: true, opacity: 0.85 }), []);
  const lineGeometry = useMemo(() => {
    const values: number[] = [];
    TWIN_POLES.forEach((pole) => values.push(WAPDA_GRID_POS[0], 2.2, WAPDA_GRID_POS[2], pole.x, 2, pole.z));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    return geometry;
  }, []);

  useEffect(() => { dataRef.current = liveData; }, [liveData]);

  const animate = useCallback((elapsed: number) => {
    const particleMesh = particleRef.current;
    if (!particleMesh) return;
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    TWIN_POLES.forEach((pole, index) => {
      const reading = dataRef.current.get(pole.id);
      const active = reading ? isReadingOn(reading) : true;
      const progress = (elapsed * 0.18 + index * 0.037) % 1;
      point.set(
        THREE.MathUtils.lerp(WAPDA_GRID_POS[0], pole.x, progress),
        THREE.MathUtils.lerp(2.2, 2, progress),
        THREE.MathUtils.lerp(WAPDA_GRID_POS[2], pole.z, progress),
      );
      matrix.compose(point, new THREE.Quaternion(), new THREE.Vector3(active ? 1 : 0, active ? 1 : 0, active ? 1 : 0));
      particleMesh.setMatrixAt(index, matrix);
    });
    particleMesh.instanceMatrix.needsUpdate = true;
  }, []);
  useTwinAnimation(animate);

  return (
    <group>
      <lineSegments geometry={lineGeometry} frustumCulled>
        <lineBasicMaterial color="#00D4FF" transparent opacity={0.12} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={particleRef} args={[particles, particleMaterial, TWIN_POLES.length]} frustumCulled>
        <primitive object={particles} attach="geometry" />
        <primitive object={particleMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}

function riskColor(status: TwinHealthStatus, risk: number) {
  if (status === 'FAIL' || risk > 0.8) return '#FF4D5A';
  if (status === 'WARN' || risk >= 0.7) return '#FFD166';
  return '#00E5FF';
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 96 + 2},${22 - ((value - min) / Math.max(1, max - min)) * 18}`).join(' ');
  return <svg viewBox="0 0 100 24" className="mt-1 h-6 w-full" aria-label="Last 60 seconds temperature trend"><polyline points={points} fill="none" stroke="#00E5FF" strokeWidth="1.4" /></svg>;
}

function PoleLabels({
  liveData,
  historyData,
  selectedPole,
  hoveredPole,
  onSelectPole,
  onTogglePole,
  onDimPole,
}: {
  liveData: TwinLiveData;
  historyData?: TwinHistoryData;
  selectedPole: string | null;
  hoveredPole: string | null;
  onSelectPole: (poleId: string) => void;
  onTogglePole: (poleId: string) => void;
  onDimPole: (poleId: string) => void;
}) {
  return (
    <>
      {TWIN_POLES.map((pole) => {
        const reading = liveData.get(pole.id) ?? defaultReading(pole.id);
        const risk = calculateRisk(reading);
        const status = getHealthStatus(reading);
        const focused = selectedPole === pole.id || hoveredPole === pole.id;
        const on = isReadingOn(reading);
        const values = (historyData?.[pole.id] ?? []).slice(-30).map((point) => point.temp);
        const critical = status === 'FAIL' || risk > 0.8;
        return (
          <Html key={`label-${pole.id}`} position={[pole.x, POLE_HEIGHT + 1.2, pole.z]} center distanceFactor={17}>
            <div
              className="pointer-events-none min-w-[164px] rounded-lg border bg-black/75 p-2.5 font-mono text-[10px] leading-tight text-white shadow-[0_0_18px_rgba(0,212,255,0.16)] backdrop-blur-xl"
              style={{ borderColor: critical ? 'rgba(255,77,90,.75)' : focused ? 'rgba(255,255,255,.8)' : 'rgba(0,229,255,.55)' }}
            >
              <div className="text-[10px] font-semibold text-cyan-200">{pole.id} / {pole.section} / {on ? 'ON' : 'OFF'}</div>
              <div className="mt-1 text-[9px] text-white/80">{reading.watt.toFixed(0)}W / {reading.temp.toFixed(1)}C / {Math.round(risk * 100)}% RISK</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full" style={{ width: `${Math.min(100, risk * 100)}%`, background: riskColor(status, risk) }} /></div>
              <div className="mt-1 text-[8px] uppercase tracking-[0.08em]" style={{ color: riskColor(status, risk) }}>{status} / SENSOR LINKED</div>
              {risk >= 0.7 && <div className="mt-1 text-[8px] uppercase tracking-[0.08em]" style={{ color: riskColor(status, risk) }}>AI PREDICTED FAILURE IN 2.3 H</div>}
              {selectedPole === pole.id && (
                <>
                  <Sparkline values={values} />
                  <div className="pointer-events-auto mt-1.5 flex gap-1">
                    <button type="button" onClick={() => onTogglePole(pole.id)} className="flex-1 rounded border border-cyan-300/45 bg-transparent px-1 py-1 text-[8px] uppercase tracking-[0.08em] text-cyan-100 hover:bg-cyan-300/10">{on ? 'Power Off' : 'Power On'}</button>
                    <button type="button" onClick={() => onDimPole(pole.id)} className="flex-1 rounded border border-white/25 bg-transparent px-1 py-1 text-[8px] uppercase tracking-[0.08em] text-white/80 hover:border-cyan-300/50">Dim 70%</button>
                  </div>
                </>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function HolographicPoles({
  liveData,
  historyData,
  selectedPole,
  onSelectPole,
  onTogglePole,
  onDimPole,
}: {
  liveData: TwinLiveData;
  historyData?: TwinHistoryData;
  selectedPole: string | null;
  onSelectPole: (poleId: string) => void;
  onTogglePole: (poleId: string) => void;
  onDimPole: (poleId: string) => void;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredPole, setHoveredPole] = useState<string | null>(null);
  const bodyGeometry = useMemo(() => new THREE.CylinderGeometry(0.07, 0.09, POLE_HEIGHT, 6), []);
  const lampGeometry = useMemo(() => new THREE.SphereGeometry(0.24, 8, 6), []);
  const bodyMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true, transparent: true, opacity: 0.85 }), []);
  const lampMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }), []);
  const liveDataRef = useRef(liveData);

  useEffect(() => { liveDataRef.current = liveData; }, [liveData]);

  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const body = new THREE.Color();
    const lamp = new THREE.Color();
    TWIN_POLES.forEach((pole, index) => {
      const reading = liveData.get(pole.id) ?? defaultReading(pole.id);
      const risk = calculateRisk(reading);
      const status = getHealthStatus(reading);
      const active = isReadingOn(reading);
      matrix.compose(new THREE.Vector3(pole.x, POLE_HEIGHT / 2, pole.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      bodyRef.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(pole.x, POLE_HEIGHT + 0.18, pole.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      lampRef.current?.setMatrixAt(index, matrix);
      body.set(status === 'FAIL' ? '#FF4D5A' : '#00D4FF');
      const dimmed = active && reading.baseWatt > 0 && reading.watt / reading.baseWatt < 0.85;
      lamp.set(active ? (status === 'FAIL' || risk > 0.8 ? '#FF4D5A' : status === 'WARN' || risk >= 0.7 ? '#FFD166' : dimmed ? '#00E5FF' : '#FFE2A3') : '#29313A');
      bodyRef.current?.setColorAt(index, body);
      lampRef.current?.setColorAt(index, lamp);
    });
    if (bodyRef.current) {
      bodyRef.current.instanceMatrix.needsUpdate = true;
      if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
    }
    if (lampRef.current) {
      lampRef.current.instanceMatrix.needsUpdate = true;
      if (lampRef.current.instanceColor) lampRef.current.instanceColor.needsUpdate = true;
    }
  }, [liveData]);

  const animate = useCallback((elapsed: number) => {
    const lampMesh = lampRef.current;
    if (!lampMesh) return;
    const matrix = new THREE.Matrix4();
    TWIN_POLES.forEach((pole, index) => {
      const reading = liveDataRef.current.get(pole.id) ?? defaultReading(pole.id);
      const critical = getHealthStatus(reading) === 'FAIL' || calculateRisk(reading) > 0.8;
      const pulse = critical ? 1 + Math.max(0, Math.sin(elapsed * 9 + index) * 0.15) : 1;
      matrix.compose(new THREE.Vector3(pole.x, POLE_HEIGHT + 0.18, pole.z), new THREE.Quaternion(), new THREE.Vector3(pulse, pulse, pulse));
      lampMesh.setMatrixAt(index, matrix);
    });
    lampMesh.instanceMatrix.needsUpdate = true;
  }, []);
  useTwinAnimation(animate);

  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const index = event.instanceId;
    if (index === undefined) return;
    const pole = TWIN_POLES[index];
    if (pole) onSelectPole(pole.id);
  };
  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const index = event.instanceId;
    if (index !== undefined && TWIN_POLES[index]) {
      setHoveredPole(TWIN_POLES[index].id);
      document.body.style.cursor = 'pointer';
    }
  };
  const handleOut = () => {
    setHoveredPole(null);
    document.body.style.cursor = 'default';
  };

  return (
    <>
      <instancedMesh ref={bodyRef} args={[bodyGeometry, bodyMaterial, TWIN_POLES.length]} onClick={handlePointer} onPointerOver={handleOver} onPointerOut={handleOut} frustumCulled>
        <primitive object={bodyGeometry} attach="geometry" />
        <primitive object={bodyMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={lampRef} args={[lampGeometry, lampMaterial, TWIN_POLES.length]} onClick={handlePointer} onPointerOver={handleOver} onPointerOut={handleOut} frustumCulled>
        <primitive object={lampGeometry} attach="geometry" />
        <primitive object={lampMaterial} attach="material" />
      </instancedMesh>
      <PoleLabels liveData={liveData} historyData={historyData} selectedPole={selectedPole} hoveredPole={hoveredPole} onSelectPole={onSelectPole} onTogglePole={onTogglePole} onDimPole={onDimPole} />
    </>
  );
}

type OrbitControlsHandle = ComponentRef<typeof OrbitControls>;

function CameraFlyController({ selectedPole, sectionFilter, controlsRef }: { selectedPole: string | null; sectionFilter: SectionName; controlsRef: React.RefObject<OrbitControlsHandle | null> }) {
  const target = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const selected = selectedPole ? TWIN_POLES.find((pole) => pole.id === selectedPole) : null;
    const members = selected ? [selected] : sectionFilter === 'ALL' ? [] : TWIN_POLES.filter((pole) => pole.section === sectionFilter);
    if (!members.length) {
      target.current = null;
      return;
    }
    const center = members.reduce((sum, pole) => sum.add(new THREE.Vector3(pole.x, 1.5, pole.z)), new THREE.Vector3()).multiplyScalar(1 / members.length);
    target.current = center;
  }, [selectedPole, sectionFilter]);

  useFrame(() => {
    if (!target.current || !controlsRef.current) return;
    const controls = controlsRef.current;
    const desiredCamera = target.current.clone().add(new THREE.Vector3(22, 22, 28));
    controls.target.lerp(target.current, 0.08);
    controls.object.position.lerp(desiredCamera, 0.055);
    controls.update();
    if (controls.target.distanceTo(target.current) < 0.1) target.current = null;
  });
  return null;
}

function BlueprintWorld(props: TwinBlueprintViewProps & { controlsRef: React.RefObject<OrbitControlsHandle | null> }) {
  const { liveData, historyData, selectedPole, sectionFilter = 'ALL', onSelectPole, onTogglePole, onDimPole, controlsRef } = props;
  const totalWatt = useMemo(() => [...liveData.values()].reduce((sum, reading) => sum + (isReadingOn(reading) ? reading.watt : 0), 0), [liveData]);

  return (
    <>
      <color attach="background" args={['#01030A']} />
      <fog attach="fog" args={['#01030A', 70, 320]} />
      <ambientLight intensity={0.3} color="#00D4FF" />
      <CameraFlyController selectedPole={selectedPole} sectionFilter={sectionFilter} controlsRef={controlsRef} />
      <HoloBuildings />
      <HoloRoads />
      <EnergyNetwork liveData={liveData} />
      <WapdaGridStation totalWatt={totalWatt} />
      <HolographicPoles liveData={liveData} historyData={historyData} selectedPole={selectedPole} onSelectPole={onSelectPole} onTogglePole={onTogglePole} onDimPole={onDimPole} />
    </>
  );
}

export default function TwinBlueprintView(props: TwinBlueprintViewProps) {
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#01030A] text-white">
      <Canvas
        className="absolute inset-0"
        dpr={[1, 1.1]}
        frameloop="demand"
        camera={{ position: [0, 78, 112], fov: 46, near: 0.1, far: 700 }}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#01030A');
          props.onCanvasReady?.(gl.domElement);
        }}
      >
        <TwinAnimationClock>
          <BlueprintWorld {...props} controlsRef={controlsRef} />
        </TwinAnimationClock>
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={15} maxDistance={260} />
      </Canvas>
      <IoTFlowDiagram liveData={props.liveData} logs={props.logs} />
    </div>
  );
}
