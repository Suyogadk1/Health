"use client";

import Image from "next/image";
import { Headphones, Mic, Volume2 } from "lucide-react";
import type { VoiceState } from "@/types";

export function VoiceAvatar({ state, muted = false }: { state: VoiceState; muted?: boolean }) {
  const active = state === "speaking" || (state === "listening" && !muted);
  const label = state === "speaking" ? "Speaking with you" : state === "thinking" ? "Taking in your words" : state === "connecting" ? "Getting ready" : state === "listening" ? muted ? "Microphone muted" : "Listening to you" : "Your space to talk";
  return <div className="voice-avatar" data-state={muted && state === "listening" ? "muted" : state}>
    <div className="avatar-orbit" aria-hidden="true" />
    <div className="avatar-orbit second" aria-hidden="true" />
    <div className="avatar-portrait">
      <Image src="/images/voice-companion-female.png" alt="An AI-generated female companion with a warm, welcoming expression" fill priority sizes="(max-width: 640px) 260px, 300px" className="avatar-photo" />
      <div className="avatar-soft-shade" />
      <span className="avatar-ai-label"><span /> AI companion</span>
      <div className="avatar-name"><span>Here, with you.</span><small>A little space to feel heard.</small></div>
    </div>
    <div className="avatar-presence" aria-label={label}>
      <span className={`avatar-status-icon ${active ? "active" : ""}`}>
        {state === "speaking" ? <Volume2 size={16} /> : state === "listening" && !muted ? <Mic size={16} /> : <Headphones size={16} />}
      </span>
      <div><strong>{label}</strong><span>{state === "speaking" ? "You can interrupt anytime" : "MindCare voice companion"}</span></div>
      <div className={`avatar-wave ${active ? "active" : ""}`} aria-hidden="true">{[0,1,2,3,4].map(i => <i key={i} style={{ animationDelay: `${i * 0.13}s` }} />)}</div>
    </div>
    <span className="avatar-disclosure">AI-generated portrait</span>
  </div>;
}
