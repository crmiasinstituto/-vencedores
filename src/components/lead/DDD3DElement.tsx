import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';

interface RegionData {
  estado: string;
  cidade: string;
  emoji: string;
  cor: string;
  mensagem: string;
  region: string;
}

interface DDD3DElementProps {
  region?: RegionData | null;
}

const AnimatedGeometry: React.FC<{ region?: RegionData | null }> = ({ region }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const regionColor = useMemo(() => {
    if (!region?.cor) return '#3B82F6'; // Dourado + que Vencedores default
    return region.cor;
  }, [region?.cor]);

  const geometry = useMemo(() => {
    if (!region) return new THREE.IcosahedronGeometry(1, 0);
    
    switch (region.estado) {
      case 'SP': return new THREE.BoxGeometry(1.5, 1.5, 1.5);
      case 'RJ': return new THREE.SphereGeometry(1, 32, 32);
      case 'MG': return new THREE.ConeGeometry(1, 2, 8);
      case 'PR': return new THREE.CylinderGeometry(0.5, 1, 2, 8);
      case 'RS': return new THREE.TorusGeometry(1, 0.4, 16, 100);
      default: return new THREE.IcosahedronGeometry(1, 1);
    }
  }, [region?.estado]);

  // Particle system
  const particleGeometry = useMemo(() => {
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(150); // 50 particles * 3 coordinates
    
    for (let i = 0; i < 150; i += 3) {
      positions[i] = (Math.random() - 0.5) * 4;     // x
      positions[i + 1] = (Math.random() - 0.5) * 4; // y  
      positions[i + 2] = (Math.random() - 0.5) * 4; // z
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return particles;
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.3;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5;
      
      // Pulse effect when region detected
      if (region) {
        const scale = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.1;
        meshRef.current.scale.setScalar(scale);
      }
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.2;
    }
  });

  return (
    <>
      {/* Main geometry */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color={regionColor}
          emissive={regionColor}
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Particle system */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color={regionColor}
          size={0.02}
          transparent
          opacity={0.6}
        />
      </points>

      {/* Wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={regionColor}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </>
  );
};

export const DDD3DElement: React.FC<DDD3DElementProps> = ({ region }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full"
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 2]} intensity={1} color="#3B82F6" />
        <pointLight position={[-2, -2, -2]} intensity={0.5} color="#000000" />

        {/* 3D Elements */}
        <AnimatedGeometry region={region} />
      </Canvas>

      {/* Overlay effects */}
      {region && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Glow effect */}
          <div 
            className="absolute inset-0 rounded-full opacity-20 blur-xl"
            style={{ 
              background: `radial-gradient(circle, ${region.cor}40 0%, transparent 70%)` 
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};

export default DDD3DElement;