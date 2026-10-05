'use client';

import { Html } from '@react-three/drei';
import { memo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TwinLight } from '../hooks/useTwinSimulation';

const POLE_HEIGHT = 4.5;
const MAIN_ARM_WIDTH = 2.5;
const NORMAL_ARM_LENGTH = 1.2;

// Shared low-poly geometry keeps the premium shape affordable for all 75 lights.
const BASE_GEOMETRY = new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8);
const POLE_GEOMETRY = new THREE.CylinderGeometry(0.04, 0.09, POLE_HEIGHT, 8).translate(0, POLE_HEIGHT / 2, 0);
const MAIN_ARM_GEOMETRY = new THREE.BoxGeometry(MAIN_ARM_WIDTH, 0.05, 0.05).translate(0, POLE_HEIGHT - 0.04, 0);
const NORMAL_ARM_GEOMETRY = new THREE.BoxGeometry(NORMAL_ARM_LENGTH, 0.05, 0.05).translate(NORMAL_ARM_LENGTH / 2, POLE_HEIGHT - 0.04, 0);

function createPaddleShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

const GLASS_GEOMETRY = new THREE.ExtrudeGeometry(createPaddleShape(0.78, 0.18, 0.07), {
  depth: 0.3,
  bevelEnabled: true,
  bevelThickness: 0.025,
  bevelSize: 0.025,
  bevelSegments: 2,
  curveSegments: 4,
}).translate(0, 0, -0.15);
const BULB_GEOMETRY = new THREE.BoxGeometry(0.58, 0.045, 0.15);

export type TwinPoleProps = {
  light: TwinLight;
  position?: [number, number, number];
  rotationY?: number;
  /** Layout road identifier; MAIN and ROAD-MAIN use the divider T-arm. */
  road?: string;
  isMainRoad?: boolean;
  roadName?: string;
  streetName?: string;
  showHologram?: boolean;
};

function riskColor(risk: number): string {
  if (risk > 0.8) return '#ef4444';
  if (risk > 0.6) return '#f97316';
  if (risk >= 0.3) return '#facc15';
  return '#ffffff';
}

function TwinPole({
  light,
  position = [0, 0, 0],
  rotationY = 0,
  road,
  isMainRoad: mainRoadProp,
  roadName = light.street_id,
  streetName = 'Town Road',
  showHologram = false,
}: TwinPoleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const worldPosition = useRef(new THREE.Vector3());
  const camera = useThree((state) => state.camera);
  const [nearby, setNearby] = useState(true);
  const nearbyRef = useRef(true);
  const [hovered, setHovered] = useState(false);
  const isMainRoad = mainRoadProp ?? (road === 'MAIN' || road === 'ROAD-MAIN');
  const isOn = light.live.status === 'ON';
  const lampColor = isOn ? riskColor(light.live.risk) : '#000000';
  const isCritical = light.live.risk > 0.8 && isOn;

  useFrame(() => {
    if (showHologram && groupRef.current) {
      const distance = groupRef.current.getWorldPosition(worldPosition.current).distanceTo(camera.position);
      const nextNearby = distance < 30;
      if (nextNearby !== nearbyRef.current) {
        nearbyRef.current = nextNearby;
        setNearby(nextNearby);
      }
    }
  });

  const lampPositions: Array<[number, number, number]> = isMainRoad
    ? [[-MAIN_ARM_WIDTH / 2, POLE_HEIGHT - 0.16, 0], [MAIN_ARM_WIDTH / 2, POLE_HEIGHT - 0.16, 0]]
    : [[NORMAL_ARM_LENGTH, POLE_HEIGHT - 0.16, 0]];

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      name={light.id}
      userData={{ twinId: light.id, gridId: light.grid_id, streetId: light.street_id, isMainRoad }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh geometry={BASE_GEOMETRY} position={[0, 0.09, 0]} frustumCulled>
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={POLE_GEOMETRY} frustumCulled>
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={isMainRoad ? MAIN_ARM_GEOMETRY : NORMAL_ARM_GEOMETRY} frustumCulled>
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>

      {lampPositions.map((lampPosition, index) => (
        <group key={`${light.id}-lamp-${index}`} position={lampPosition}>
          <mesh geometry={GLASS_GEOMETRY} frustumCulled>
            <meshPhysicalMaterial
              color={isOn ? lampColor : '#050505'}
              transmission={0.6}
              thickness={0.2}
              roughness={0.12}
              transparent
              opacity={0.86}
            />
          </mesh>
          <mesh geometry={BULB_GEOMETRY} frustumCulled>
            <meshStandardMaterial
              color={lampColor}
              emissive={lampColor}
              emissiveIntensity={isCritical ? 1.8 : isOn ? 0.75 + light.live.risk : 0}
              toneMapped={!isCritical}
            />
          </mesh>
        </group>
      ))}

      {showHologram && (nearby || hovered) && (
        <Html position={[0, POLE_HEIGHT + 0.55, 0]} center distanceFactor={12} occlude zIndexRange={[10, 20]}>
          <div
            className={`rounded-full border px-2 py-1 text-[10px] font-mono leading-tight text-white backdrop-blur ${isCritical ? 'animate-pulse border-red-500' : 'border-white/20'}`}
            style={{ minWidth: 172, background: 'rgba(0, 0, 0, 0.72)', borderColor: isCritical ? '#ef4444' : `${lampColor}88`, boxShadow: isCritical ? '0 0 18px rgba(239, 68, 68, 0.75)' : '0 0 10px rgba(96, 165, 250, 0.35)', whiteSpace: 'nowrap' }}
          >
            <strong className="font-bold text-cyan-300">{light.id} - {roadName} | {streetName}</strong>
            <div>{light.live.watt.toFixed(1)}W | {light.live.temp.toFixed(1)}°C | Risk {light.live.risk.toFixed(2)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default memo(TwinPole);
