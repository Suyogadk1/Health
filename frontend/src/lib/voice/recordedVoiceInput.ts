type Callbacks = {
  onReady: () => void;
  onSilence: () => void;
  onTranscript: (text: string) => void;
  onTranscribing: () => void;
  onError: (message: string) => void;
};

/** Capture microphone audio directly; no browser SpeechRecognition service is used. */
export class RecordedVoiceInput {
  private version = 0;
  private stream?: MediaStream;
  private context?: AudioContext;
  private processor?: ScriptProcessorNode;
  private playback = false;
  private running = false;
  private onset?: () => void;
  private interval?: ReturnType<typeof setInterval>;
  private request?: AbortController;
  private nudged = false;
  private finishCapture?: () => void;
  constructor(private callbacks: Callbacks) {}
  static supported() {
    return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined";
  }
  isRunning() { return this.running; }
  setPlayback(value: boolean) { this.playback = value; }
  reset() { this.stop(); this.nudged = false; }
  finish() { if (this.finishCapture) this.finishCapture(); else this.stop(); }
  stop() {
    this.version++;
    this.request?.abort();
    this.request = undefined;
    this.release();
  }
  private release() {
    this.finishCapture = undefined;
    clearInterval(this.interval);
    this.interval = undefined;
    this.running = false;
    if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); }
    this.processor = undefined;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
  async start(language: string, options: { playback?: boolean; onSpeechStart?: () => void } = {}) {
    this.stop();
    const version = this.version;
    this.playback = !!options.playback;
    this.onset = options.onSpeechStart;
    try {
      // Resume inside the Start-call user gesture, before awaiting permissions.
      const context = new AudioContext({ sampleRate: 16000 });
      this.context = context;
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (version !== this.version) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const processor = context.createScriptProcessor(4096, 1, 1);
      this.processor = processor;
      context.createMediaStreamSource(stream).connect(processor);
      processor.connect(context.destination);
      let chunks: Float32Array[] = [];
      processor.onaudioprocess = event => {
        if (version !== this.version) return;
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        // While the AI is speaking keep only a brief pre-roll, not its whole reply.
        if (this.playback || !heard) {
          while (chunks.length > Math.ceil(context.sampleRate * 0.4 / 4096)) chunks.shift();
        }
      };
      const wav = () => {
        const length = chunks.reduce((n, c) => n + c.length, 0);
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);
        const word = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
        word(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); word(8, "WAVE");
        word(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, context.sampleRate, true); view.setUint32(28, context.sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        word(36, "data"); view.setUint32(40, length * 2, true);
        let offset = 44;
        for (const chunk of chunks) for (const value of chunk) { view.setInt16(offset, Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767), true); offset += 2; }
        return new Blob([buffer], { type: "audio/wav" });
      };
      let heard = false;
      let voicedFrames = 0;
      let lastSpeech = performance.now();
      let started = lastSpeech;
      let wasPlayback = this.playback;
      const samples = new Float32Array(analyser.fftSize);
      const submit = () => {
        if (version !== this.version || !this.running) return;
        clearInterval(this.interval);
        const audio = wav();
        void (async () => {
          if (version !== this.version) return;
          this.release();
          this.callbacks.onTranscribing();
          this.request = new AbortController();
          try {
            const res = await fetch(`/api/transcribe?language=${encodeURIComponent(language)}`, {
              method: "POST", headers: { "Content-Type": "audio/wav" },
              body: audio, signal: this.request.signal,
            });
            const data = await res.json();
            if (version !== this.version) return;
            if (!res.ok) throw new Error(data.error || "Transcription failed.");
            if (typeof data.text === "string" && data.text.trim()) {
              this.nudged = false;
              this.callbacks.onTranscript(data.text.trim());
            } else {
              // Silence or inaudible sound is not a user message.
              void this.start(language);
            }
          } catch (err) {
            if (version === this.version) {
              this.stop();
              this.callbacks.onError(err instanceof Error ? err.message : "Speech transcription failed.");
            }
          }
        })();
      };
      this.running = true;
      this.finishCapture = () => {
        if (heard) submit();
        else { this.stop(); this.callbacks.onReady(); }
      };
      this.callbacks.onReady();
      this.interval = setInterval(() => {
        if (version !== this.version) return;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) sum += value * value;
        const active = Math.sqrt(sum / samples.length) > (this.playback ? 0.025 : 0.012);
        const now = performance.now();
        if (wasPlayback && !this.playback && !heard) { started = now; chunks = []; }
        wasPlayback = this.playback;
        if (active) {
          voicedFrames++;
          if (!heard && voicedFrames >= (this.playback ? 5 : 3)) {
            heard = true;
            if (this.playback) { this.playback = false; this.onset?.(); }
          }
          lastSpeech = now;
        } else voicedFrames = 0;
        // Nepali speakers may pause inside a phrase; preserve that context in one upload.
        if (heard && (now - lastSpeech > (language.startsWith("ne") ? 1500 : 1000) || now - started > 120000)) submit();
        else if (!this.playback && !heard && !this.nudged && now - started >= 5000) {
          this.nudged = true;
          this.stop();
          this.callbacks.onSilence();
        }
      }, 50);
    } catch (err) {
      if (version !== this.version) return;
      this.stop();
      const name = err instanceof Error ? err.name : "";
      this.callbacks.onError(name === "NotAllowedError" ? "Microphone access is blocked. Allow the microphone for this site, then start again." : name === "NotFoundError" ? "No microphone was found. Connect a microphone and start again." : "Could not capture microphone audio. Check your microphone settings and try again.");
    }
  }
}
