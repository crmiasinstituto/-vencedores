import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';

interface AIBrainProps {
  scale?: number;
  speed?: number;
}

function AIBrainCore({ scale = 1, speed = 1 }: AIBrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.1;
      meshRef.current.rotation.y += 0.01 * speed;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * speed * 0.2) * 0.3;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main brain sphere */}
      <mesh ref={meshRef} position={[0, 0, 0]} scale={scale}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color="#10b981"
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.8}
          emissive="#10b981"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Orbiting neural nodes */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 2 * scale;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle + Math.PI / 4) * radius * 0.5,
              Math.sin(angle) * radius
            ]}
            scale={scale}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color="#facc15"
              metalness={0.9}
              roughness={0.1}
              emissive="#facc15"
              emissiveIntensity={0.4}
            />
          </mesh>
        );
      })}

      {/* Inner core */}
      <mesh position={[0, 0, 0]} scale={scale}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial
          color="#facc15"
          metalness={1}
          roughness={0}
          emissive="#facc15"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

export default function AIBrain3D({ className = "", scale = 1 }: { className?: string; scale?: number }) {
  return (
    <motion.div
      className={`w-full h-full ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.6} color="#facc15" />
        <spotLight position={[0, 10, 0]} intensity={0.8} />
        <AIBrainCore scale={scale} speed={1} />
      </Canvas>
    </motion.div>
  );
}
