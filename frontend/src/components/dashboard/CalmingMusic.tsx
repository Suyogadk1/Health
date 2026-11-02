"use client";

import { useEffect, useRef, useState } from "react";

export function CalmingMusic({ request }: { request: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [asking, setAsking] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (request > 0) setAsking(true);
  }, [request]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  async function play() {
    setAsking(false);
    setEnabled(true);
    setError("");
    try {
      if (audio.current) {
        audio.current.volume = 0.25;
        await audio.current.play();
      }
    } catch {
      setError("Music could not start. Please use the play control to try again.");
    }
  }

  return <>
    <audio ref={audio} src="/audio/calming-piano.wav" loop controls={enabled}
      aria-label="Calming music player" className={enabled ? "w-full" : "hidden"}
      onError={() => setError("Music is unavailable. Please try again later.")} />
    {asking && <section role="region" aria-label="Calming music permission" className="rounded-2xl border border-sage bg-warm-white p-5 space-y-3">
      <h2 className="font-serif text-lg">Would you like some calming music?</h2>
      <p className="text-sm">You checked in feeling low. Gentle music may help you take a quiet moment. Play it now?</p>
      <div className="flex gap-3">
        <button type="button" onClick={play} className="rounded-full bg-deep-sage px-4 py-2 text-white">Yes, play music</button>
        <button type="button" onClick={() => { setAsking(false); audio.current?.pause(); }} className="rounded-full border px-4 py-2">No thanks</button>
      </div>
    </section>}
    {enabled && <button type="button" className="text-sm underline" onClick={() => { audio.current?.pause(); setEnabled(false); }}>Stop and close music</button>}
    {error && <p role="status" className="text-sm">{error}</p>}
  </>;
}
