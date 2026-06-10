interface Mannequin3DProps {
  position?: [number, number, number];
}

export function Mannequin3D({ position = [0, 0, 0] }: Mannequin3DProps) {
  // Renders a stylized mannequin of 1.75m height
  // Torso center around y = 1.0, Head top around y = 1.75
  return (
    <group position={position}>
      {/* Head */}
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.11, 32, 32]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 16]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.4} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.12, 0.65, 32]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Left Arm */}
      <mesh position={[-0.23, 1.05, 0]} rotation={[0, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.035, 0.025, 0.55, 16]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} />
      </mesh>

      {/* Right Arm */}
      <mesh position={[0.23, 1.05, 0]} rotation={[0, 0, -0.08]} castShadow>
        <cylinderGeometry args={[0.035, 0.025, 0.55, 16]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} />
      </mesh>

      {/* Left Leg */}
      <mesh position={[-0.08, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.035, 0.76, 16]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} />
      </mesh>

      {/* Right Leg */}
      <mesh position={[0.08, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.035, 0.76, 16]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} />
      </mesh>
    </group>
  );
}
