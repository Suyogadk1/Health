"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";

export function VoiceControls({
  muted,
  onToggleMute,
  onEnd,
}: {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onToggleMute}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-warm-white border border-charcoal/10 text-charcoal"
      >
        {muted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
      <button
        onClick={onEnd}
        aria-label="End conversation"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-dusty-rose text-warm-white"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
}
