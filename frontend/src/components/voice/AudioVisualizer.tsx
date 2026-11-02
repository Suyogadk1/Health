"use client";

import { useEffect, useRef } from "react";

// Draws a simple live waveform from the microphone while listening. Falls
// back to a gentle idle line when there's no active audio stream.
export function AudioVisualizer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let analyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

    async function setup() {
      if (!active) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        draw();
      } catch {
        drawIdle();
      }
    }

    function draw() {
      if (!ctx || !canvas) return;
      rafRef.current = requestAnimationFrame(draw);
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = canvas.width / dataArray.length;
        dataArray.forEach((value, i) => {
          const height = (value / 255) * canvas.height;
          ctx.fillStyle = "#A8BFA3";
          ctx.fillRect(i * barWidth, canvas.height - height, barWidth - 1, height);
        });
      }
    }

    function drawIdle() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#D8C8AD";
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    if (active) setup();
    else drawIdle();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
  }, [active]);

  return <canvas ref={canvasRef} width={280} height={48} className="w-full max-w-xs" />;
}
