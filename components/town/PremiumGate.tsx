import React from 'react';
import { Text } from '@react-three/drei';
import { COLORS, GATE_WIDTH, WALL_HEIGHT, WALL_THICK, GROUND_SIZE } from './town.config';

export default function PremiumGate() {
  const gateHeight = WALL_HEIGHT * 1.5;
  const gateZ = GROUND_SIZE / 2;
  const pillarWidth = 1.5;
  
  return (
    <group position={[0, 0, gateZ]}>
      {/* Left Pillar */}
      <mesh position={[-GATE_WIDTH / 2 - pillarWidth / 2, gateHeight / 2, 0]} castShadow>
        <boxGeometry args={[pillarWidth, gateHeight, pillarWidth]} />
        <meshStandardMaterial color={COLORS.gate} roughness={0.7} />
      </mesh>
      {/* Left Pillar Cap */}
      <mesh position={[-GATE_WIDTH / 2 - pillarWidth / 2, gateHeight + 0.1, 0]} castShadow>
        <boxGeometry args={[pillarWidth + 0.2, 0.2, pillarWidth + 0.2]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.8} />
      </mesh>

      {/* Right Pillar */}
      <mesh position={[GATE_WIDTH / 2 + pillarWidth / 2, gateHeight / 2, 0]} castShadow>
        <boxGeometry args={[pillarWidth, gateHeight, pillarWidth]} />
        <meshStandardMaterial color={COLORS.gate} roughness={0.7} />
      </mesh>
      {/* Right Pillar Cap */}
      <mesh position={[GATE_WIDTH / 2 + pillarWidth / 2, gateHeight + 0.1, 0]} castShadow>
        <boxGeometry args={[pillarWidth + 0.2, 0.2, pillarWidth + 0.2]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.8} />
      </mesh>

      {/* Top Beam */}
      <mesh position={[0, gateHeight - 0.2, 0]} castShadow>
        <boxGeometry args={[GATE_WIDTH, 0.6, 1.2]} />
        <meshStandardMaterial color={COLORS.gate} roughness={0.6} />
      </mesh>
      
      {/* Town Name Text */}
      <Text
        position={[0, gateHeight - 0.2, 0.65]}
        fontSize={0.4}
        color={COLORS.wall}
        anchorX="center"
        anchorY="middle"
      >
        PROPVERSE
      </Text>

      {/* Left Guard Room */}
      <group position={[-GATE_WIDTH / 2 - pillarWidth - 1.5, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2, 3, 2]} />
          <meshStandardMaterial color={COLORS.civicBody} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[2.2, 0.2, 2.2]} />
          <meshStandardMaterial color={COLORS.civicTrim} roughness={0.8} />
        </mesh>
      </group>

      {/* Right Guard Room */}
      <group position={[GATE_WIDTH / 2 + pillarWidth + 1.5, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2, 3, 2]} />
          <meshStandardMaterial color={COLORS.civicBody} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[2.2, 0.2, 2.2]} />
          <meshStandardMaterial color={COLORS.civicTrim} roughness={0.8} />
        </mesh>
      </group>

      {/* Spotlights (Optional, could just be emissive meshes) */}
      <mesh position={[-GATE_WIDTH / 2 - pillarWidth / 2, gateHeight - 1, 0.8]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={COLORS.lightBulb} emissive={COLORS.lightBulb} emissiveIntensity={1} />
      </mesh>
      <mesh position={[GATE_WIDTH / 2 + pillarWidth / 2, gateHeight - 1, 0.8]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={COLORS.lightBulb} emissive={COLORS.lightBulb} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}
