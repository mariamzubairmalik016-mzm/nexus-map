"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

const RealisticEarth = () => {
  const earthRef = useRef<Mesh>(null);

  // Load high-resolution textures locally
  const [colorMap, bumpMap, specularMap] = useTexture([
    "/textures/earth-color.jpg",
    "/textures/earth-bump.png",
    "/textures/earth-water.png",
  ]);

  return (
    <group rotation={[0.2, 0, 0]}>
      {/* Big Earth (Radius 1.45) restored to fill the space beautifully! */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1.45, 64, 64]} />
        <meshStandardMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.015}
          roughnessMap={specularMap}
          roughness={0.6}
          metalness={0.2}
          emissive="#111111"
        />
      </mesh>
    </group>
  );
};

const HeroGlobe = () => (
  // aspect-square GUARANTEES the container is a perfect 1:1 box.
  // This means rounded-full will be a PERFECT circle, not an oval!
  // And the 3D Camera will have a perfect 1:1 aspect ratio, preventing ANY clipping!
  <div className="relative mx-auto aspect-square w-full max-w-[500px]">
    {/* The outer cyan ring will now be a perfect circle */}
    <div className="absolute inset-4 rounded-full border border-cyan-400/20 bg-cyan-400/[.03] shadow-[0_0_100px_rgba(6,182,212,.12)]" />
    
    <Canvas camera={{ position: [0, 0, 4.3], fov: 45 }} className="absolute inset-0 z-10">
      {/* Maximum Brightness Lighting */}
      <ambientLight intensity={4.0} color="#ffffff" />
      <directionalLight position={[5, 3, 5]} intensity={4.0} color="#ffffff" />
      <directionalLight position={[-5, -3, -5]} intensity={2.0} color="#06b6d4" />
      <pointLight position={[0, 0, 5]} intensity={3.0} color="#ffffff" />
      
      <Stars radius={35} depth={20} count={1200} factor={2} fade speed={0.4} />
      
      <RealisticEarth />
      
      {/* Restored autoRotate and disabled zoom as requested! */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={true}
        autoRotateSpeed={0.8}
        enableDamping={true}
        dampingFactor={0.05}
      />
    </Canvas>
  </div>
);

export default HeroGlobe;
