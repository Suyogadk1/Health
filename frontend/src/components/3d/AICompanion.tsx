"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import type { Mesh } from "three";
import type { VoiceState } from "@/types";

// A soft, organic stand-in for a human-like companion: no face, no robot -
// a warm distorted sphere whose motion communicates state. Colors now pull
// from the "Canopy Ember" palette (fern/ember/coral) instead of the old
// muted sage/lavender/peach hexes, and motion amplitude is turned up
// noticeably across every state for a livelier, more energetic presence.
export function AICompanion({ state = "idle" }: { state?: VoiceState }) {
  const meshRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const t = useRef(0);

  const { speed, distort, color, emissive, particleColor } = useMemo(() => {
    switch (state) {
      case "listening":
        // Alert, attentive - bright ember gold, quick pulse
        return { speed: 2.1, distort: 0.55, color: "#F5A623", emissive: "#F5A623", particleColor: "#FFB84D" };
      case "thinking":
        // Warm amber churn - visibly working, not sleepy
        return { speed: 1.2, distort: 0.4, color: "#E0955A", emissive: "#E0955A", particleColor: "#F5A623" };
      case "speaking":
        // Most energetic state - vivid coral bursts in time with output
        return { speed: 3.2, distort: 0.7, color: "#FF6B57", emissive: "#FF6B57", particleColor: "#FF6B57" };
      default:
        // Idle - living fern green, still noticeably more alive than before
        return { speed: 0.9, distort: 0.38, color: "#3FB273", emissive: "#1E4A32", particleColor: "#3FB273" };
    }
  }, [state]);

  useFrame((_, delta) => {
    t.current += delta;
    if (meshRef.current) {
      // Breathing amplitude roughly doubled from the original for a
      // noticeably livelier idle presence, scaling further with state speed.
      const breathe = 1 + Math.sin(t.current * speed) * 0.14;
      meshRef.current.scale.set(breathe, breathe, breathe);
      meshRef.current.rotation.y += delta * (0.15 + speed * 0.08);
      meshRef.current.rotation.x = Math.sin(t.current * speed * 0.4) * 0.15;
    }
    if (glowRef.current) {
      const pulse = 1.15 + Math.sin(t.current * speed * 1.3) * 0.12;
      glowRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 2]} intensity={0.6} />
      <pointLight position={[0, 0, 2]} intensity={0.5} color={emissive} />

      <Float speed={1.2 + speed * 0.3} rotationIntensity={0.3} floatIntensity={0.9}>
        {/* Soft outer glow echo behind the main form - reads as energy/light rather than a flat sphere */}
        <mesh ref={glowRef} scale={1.15}>
          <icosahedronGeometry args={[1.3, 4]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.12} />
        </mesh>

        <mesh ref={meshRef}>
          <icosahedronGeometry args={[1.3, 6]} />
          <MeshDistortMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.35}
            distort={distort}
            speed={speed}
            roughness={0.3}
            metalness={0.15}
          />
        </mesh>
      </Float>

      {[...Array(7)].map((_, i) => (
        <Float key={i} speed={(0.8 + i * 0.15) * (1 + speed * 0.2)} floatIntensity={1.8 + speed * 0.3}>
          <mesh position={[Math.cos(i) * 2.6, Math.sin(i * 2) * 1.4, Math.sin(i) * 1.6]}>
            <sphereGeometry args={[0.12 + (i % 2) * 0.07, 16, 16]} />
            <meshStandardMaterial
              color={particleColor}
              emissive={particleColor}
              emissiveIntensity={0.4}
              transparent
              opacity={0.75}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}
