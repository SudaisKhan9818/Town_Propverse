'use client';

import { Html } from '@react-three/drei';
import { CIVIC_PLACEMENTS } from '@/src/features/town/data/unit-placement';
import type { GridStatus, TwinGridStation, TwinLight } from '../hooks/useTwinSimulation';

export type GridConsumption = {
  'GRID-A': number;
  'GRID-B': number;
  'GRID-C': number;
};

export type TwinGridOverlayProps = {
  gridStation: TwinGridStation;
  lights: TwinLight[];
  position?: [number, number, number];
};

const GRID_OFFSETS: Array<{ id: keyof GridConsumption; offset: [number, number, number]; color: string }> = [
  { id: 'GRID-A', offset: [-7, 7, 0], color: '#67e8f9' },
  { id: 'GRID-B', offset: [0, 9, 0], color: '#a78bfa' },
  { id: 'GRID-C', offset: [7, 7, 0], color: '#fbbf24' },
];

const defaultGridPosition: [number, number, number] = (() => {
  const placement = CIVIC_PLACEMENTS.find((item) => item.unitId === 'civic-wapda');
  return placement ? [placement.position.x, 0, placement.position.z] : [75.75, 0, 62.25];
})();

function kilowatts(watts: number): string {
  return `${(watts / 1000).toFixed(2)} kW`;
}

export default function TwinGridOverlay({
  gridStation,
  lights,
  position = defaultGridPosition,
}: TwinGridOverlayProps) {
  const groupedConsumption: GridConsumption = {
    'GRID-A': 0,
    'GRID-B': 0,
    'GRID-C': 0,
  };
  for (const light of lights) groupedConsumption[light.grid_id] += light.live.watt;

  const status = gridStation.live.status;
  const statusColor: Record<GridStatus, string> = {
    OK: '#34d399',
    WARNING: '#fb923c',
    OVERHEAT: '#f87171',
  };
  const overheating = status === 'OVERHEAT';
  const total = gridStation.live.total_consumption;
  const production = gridStation.live.production;

  return (
    <group position={[position[0], position[1] + 4, position[2]]} name="TwinGridOverlay">
      {overheating && (
        <mesh position={[0, 5, 0]}>
          <sphereGeometry args={[5, 12, 12]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      )}

      {GRID_OFFSETS.map(({ id, offset, color }) => (
        <Html key={id} position={offset} center distanceFactor={12} zIndexRange={[10, 20]}>
          <div className="rounded-full border border-white/20 bg-black/70 px-2 py-1 font-mono text-[9px] text-white backdrop-blur" style={{ borderColor: `${color}88`, whiteSpace: 'nowrap' }}>
            <strong className="font-bold" style={{ color }}>{id}</strong>: {groupedConsumption[id].toFixed(1)} W
          </div>
        </Html>
      ))}

      <Html position={[0, 11, 0]} center distanceFactor={12} zIndexRange={[10, 20]}>
        <div className="min-w-[190px] rounded-xl border bg-black/80 p-3 font-mono text-[10px] text-white backdrop-blur-xl" style={{ borderColor: statusColor[status], boxShadow: overheating ? '0 0 24px rgba(239, 68, 68, .7)' : '0 0 16px rgba(56, 189, 248, .35)', whiteSpace: 'nowrap' }}>
          <strong style={{ color: statusColor[status] }}>{gridStation.id}</strong>
          <div>TOTAL: {kilowatts(total)}</div>
          <div>SUPPLY: {kilowatts(production)}</div>
          <div>TEMP: {gridStation.live.temp.toFixed(1)}°C · {gridStation.live.status}</div>
        </div>
      </Html>
    </group>
  );
}
