"use client";

import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import type { VoiceState } from "@/types";

const AICompanion = dynamic(
  () => import("@/components/3d/AICompanion").then((m) => m.AICompanion),
  { ssr: false }
);

export function VoiceOrb({ state }: { state: VoiceState }) {
  return (
    <div className="voice-orb-shell h-64 w-64 sm:h-80 sm:w-80" data-state={state}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]}>
        <AICompanion state={state} />
      </Canvas>
    </div>
  );
}
