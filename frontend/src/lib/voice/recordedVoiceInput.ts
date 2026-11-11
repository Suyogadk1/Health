type Callbacks = {
  onReady: () => void;
  onRecovering?: (message: string) => void;
  onSignal?: (detected: boolean) => void;
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
  private recorder?: MediaRecorder;
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
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.recorder = undefined;
    if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); }
    this.processor = undefined;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
  async start(language: string, options: { playback?: boolean; onSpeechStart?: () => void; dictation?: boolean } = {}) {
    this.stop();
    const version = this.version;
    this.playback = !!options.playback;
    this.onset = options.onSpeechStart;
    try {
      // Resume inside the Start-call user gesture, before awaiting permissions.
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (version !== this.version) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      let chunks: Float32Array[] = [];
      const nativeChunks: Blob[] = [];
      const recorder = !options.playback && typeof MediaRecorder !== "undefined"
        ? new MediaRecorder(stream)
        : undefined;
      let nativeAudio: Promise<Blob> | undefined;
      if (recorder) {
        this.recorder = recorder;
        nativeAudio = new Promise(resolve => {
          recorder.ondataavailable = event => {
            if (event.data.size) nativeChunks.push(event.data);
          };
          recorder.onstop = () => resolve(new Blob(nativeChunks, { type: recorder.mimeType }));
          recorder.onerror = () => resolve(new Blob());
        });
        recorder.start();
      } else {
        const processor = context.createScriptProcessor(4096, 1, 1);
        this.processor = processor;
        context.createMediaStreamSource(stream).connect(processor);
        processor.connect(context.destination);

        processor.onaudioprocess = event => {
          if (version !== this.version) return;
          chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
          // While the AI is speaking keep only a brief pre-roll, not its whole reply.
          if (this.playback || (!heard && !options.dictation)) {
            while (chunks.length > Math.ceil(context.sampleRate * 0.9 / 4096)) chunks.shift();
          }
        };
      }
      const wav = (capturedChunks: Float32Array[]) => {
        const sampleRate = 16000;
        const ratio = context.sampleRate / sampleRate;
        const captured = new Float32Array(capturedChunks.reduce((sum, chunk) => sum + chunk.length, 0));
        let position = 0;
        for (const chunk of capturedChunks) {
          captured.set(chunk, position);
          position += chunk.length;
        }
        const length = Math.floor(captured.length / ratio);
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);
        const word = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
        word(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); word(8, "WAVE");
        word(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        word(36, "data"); view.setUint32(40, length * 2, true);
        for (let index = 0; index < length; index++) {
          const start = Math.floor(index * ratio);
          const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
          let sum = 0;
          for (let sample = start; sample < end; sample++) sum += captured[sample];
          const value = Math.max(-1, Math.min(1, sum / (end - start)));
          view.setInt16(44 + index * 2, value * (value < 0 ? 32768 : 32767), true);
        }
        return new Blob([buffer], { type: "audio/wav" });
      };
      let heard = false;
      let voicedFrames = 0;
      let lastSpeech = performance.now();
      let started = lastSpeech;
      let wasPlayback = this.playback;
      const samples = new Float32Array(analyser.fftSize);
      let submitting = false;
      const submit = () => {
        if (version !== this.version || !this.running || submitting) return;
        submitting = true;
        clearInterval(this.interval);
        void (async () => {
          if (version !== this.version) return;
          this.callbacks.onTranscribing();
          this.request = new AbortController();
          try {
            if (recorder?.state === "recording") recorder.stop();
            const recording = await nativeAudio;
            if (version !== this.version) return;
            if (recording) {
              if (!recording.size) throw new Error("No audio was captured. Check your browser’s microphone settings.");
              const decoded = await context.decodeAudioData(await recording.arrayBuffer());
              chunks = [decoded.getChannelData(0)];
            }
            if (version !== this.version) return;
            if ((options.dictation || recorder) && !chunks.some(chunk => chunk.some(sample => Math.abs(sample) >= 0.001))) {
              if (!options.dictation) {
                this.release();
                this.callbacks.onRecovering?.("No microphone sound was captured. Check your microphone and speak again.");
                void this.start(language);
                return;
              }
              throw new Error("The microphone recorded silence. Check that the correct microphone is selected and unmuted.");
            }
            const audio = wav(chunks);
            this.release();
            const res = await fetch(`/api/transcribe?language=${encodeURIComponent(language)}`, {
              method: "POST", headers: { "Content-Type": "audio/wav" },
              body: audio, signal: this.request.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (version !== this.version) return;
            if (!res.ok) throw new Error(data.error || "Transcription failed.");
            if (typeof data.text === "string" && data.text.trim()) {
              this.nudged = false;
              this.callbacks.onTranscript(data.text.trim());
            } else {
              if (options.dictation) this.callbacks.onError("No words were recognized. Check the selected language and try again.");
              else {
                this.callbacks.onRecovering?.("No words were recognized. Please repeat your question.");
                void this.start(language);
              }
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
        if (heard || recorder || (options.dictation && chunks.length > 0)) submit();
        else { this.stop(); this.callbacks.onSilence(); }
      };
      this.callbacks.onReady();
      this.interval = setInterval(() => {
        if (version !== this.version) return;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) sum += value * value;
        const level = Math.sqrt(sum / samples.length);
        if (options.dictation) this.callbacks.onSignal?.(level > 0.002);
        const active = level > (this.playback ? 0.008 : 0.003);
        const now = performance.now();
        if (wasPlayback && !this.playback && !heard) { started = now; chunks = []; }
        wasPlayback = this.playback;
        if (active) {
          voicedFrames++;
          if (!heard && voicedFrames >= 3) {
            heard = true;
            if (this.playback) { this.playback = false; this.onset?.(); }
          }
          lastSpeech = now;
        } else voicedFrames = 0;
        // Nepali speakers may pause inside a phrase; preserve that context in one upload.
        if ((!options.dictation && heard && now - lastSpeech > (language.startsWith("ne") ? 1800 : 1500)) || now - started > 120000) submit();
        else if (!options.dictation && !this.playback && !heard && !this.nudged && now - started >= 5000) {
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
