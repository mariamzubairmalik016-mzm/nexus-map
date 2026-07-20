import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Stars } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

const GlobeMesh = () => {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * .12;
  });

  return (
    <Float speed={1.6} rotationIntensity={.3} floatIntensity={.7}>
      <mesh ref={ref}>
        <sphereGeometry args={[1.45, 64, 64]} />
        <meshStandardMaterial color="#0891b2" roughness={.55} metalness={.15} wireframe />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[1.45, 64, 64]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={.12} />
      </mesh>
    </Float>
  );
};

const HeroGlobe = () => (
  <div className="relative h-[380px] w-full max-w-[560px] sm:h-[460px] lg:h-[560px]">
    <div className="absolute inset-8 rounded-full border border-cyan-400/20 bg-cyan-400/[.03] shadow-[0_0_100px_rgba(6,182,212,.12)]" />
    <Canvas camera={{ position: [0, 0, 4.3], fov: 45 }}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 4, 5]} intensity={2.4} />
      <pointLight position={[-4, -2, 3]} intensity={1.3} color="#a855f7" />
      <Stars radius={35} depth={20} count={1200} factor={2} fade speed={.4} />
      <GlobeMesh />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={.45} />
    </Canvas>
  </div>
);
export default HeroGlobe;
