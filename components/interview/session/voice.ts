"use client";

// Voice engines for the live interview. The backend decides every line; an
// engine only (a) speaks a given line and (b) reports candidate speech.

import { speakInstruction } from "@/prompts/realtime-interviewer/v1";

export type VoiceCallbacks = {
  onSpeechStart: () => void;
  onSpeechStop: () => void;
  /** `timing` is when the speech service heard this part start and stop (epoch ms), when known. */
  onTranscript: (text: string, itemId: string, timing?: SpeechTiming) => void;
  onPendingChange: (pending: number) => void;
  onConnection: (state: "connected" | "reconnecting" | "failed") => void;
  onRemoteStream: (stream: MediaStream) => void;
  onEvent: (type: string, payload?: Record<string, string | number | boolean | null>) => void;
};

export type SpeechTiming = { startedAt: number | null; stoppedAt: number | null };

export interface VoiceEngine {
  readonly kind: "openai" | "browser";
  connect(): Promise<void>;
  speak(text: string): Promise<{ transcript: string }>;
  startListening(): void;
  /**
   * Finish the current answer without losing speech: send any audio that hasn't
   * been transcribed yet and wait (up to `timeoutMs`) until every transcript
   * has arrived. Call before stopListening(), which discards untranscribed audio.
   */
  flush(timeoutMs?: number): Promise<{ timedOut: boolean }>;
  stopListening(): void;
  close(): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Time for the last syllables to reach the speech service before we send the answer off. */
const FLUSH_TAIL_MS = 450;

type Creds = { mode: "openai"; clientSecret: string; callsUrl: string; model: string } | { mode: "mock" };

export async function fetchCredentials(token: string): Promise<Creds> {
  const res = await fetch(`/api/public/interview/${token}/realtime-session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not connect to the interviewer");
  return data as Creds;
}

/** OpenAI Realtime over WebRTC using a short-lived client secret minted by our server. */
export class RealtimeVoice implements VoiceEngine {
  readonly kind = "openai" as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private mic: MediaStreamTrack;
  private pending = new Set<string>();
  private listening = false;
  /** Start/stop times per transcript item, so each line is timestamped where it was said. */
  private timing = new Map<string, SpeechTiming>();
  /** Speech heard but not yet committed for transcription (epoch ms of its start). */
  private openSpeechStart: number | null = null;
  private awaitingCommit = false;
  private waiters: (() => void)[] = [];
  private speaking: null | { resolve: (v: { transcript: string }) => void; reject: (e: Error) => void; transcript: string; timers: ReturnType<typeof setTimeout>[]; text: string } = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private creds: Extract<Creds, { mode: "openai" }>, micTrack: MediaStreamTrack, private cb: VoiceCallbacks) {
    this.mic = micTrack.clone();
    this.mic.enabled = false;
  }

  async connect() {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    this.audio = new Audio();
    this.audio.autoplay = true;
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.audio!.srcObject = stream;
      this.cb.onRemoteStream(stream);
    };
    pc.addTrack(this.mic, new MediaStream([this.mic]));
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.cb.onConnection("connected");
      } else if (s === "failed") {
        this.cb.onConnection("reconnecting");
      } else if (s === "disconnected") {
        this.disconnectTimer = setTimeout(() => pc.connectionState !== "connected" && this.cb.onConnection("reconnecting"), 3000);
      }
    };
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handle(JSON.parse(e.data));
    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Timed out connecting to the interviewer")), 20_000);
      dc.onopen = () => { clearTimeout(t); resolve(); };
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(this.creds.callsUrl, {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${this.creds.clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) throw new Error(`Interviewer connection failed (${res.status})`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await opened;
    this.cb.onConnection("connected");
    this.cb.onEvent("realtime_connected", { model: this.creds.model });
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  private finishSpeaking() {
    const s = this.speaking;
    if (!s) return;
    s.timers.forEach(clearTimeout);
    this.speaking = null;
    s.resolve({ transcript: s.transcript || s.text });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(ev: any) {
    switch (ev.type) {
      case "output_audio_buffer.stopped":
        this.finishSpeaking();
        break;
      case "response.output_audio_transcript.done":
        if (this.speaking) this.speaking.transcript = ev.transcript ?? "";
        break;
      case "response.done": {
        // Keep the realtime context small: the backend owns the conversation.
        for (const item of ev.response?.output ?? []) if (item.id) this.send({ type: "conversation.item.delete", item_id: item.id });
        if (ev.response?.status === "failed") {
          const s = this.speaking;
          this.speaking = null;
          s?.timers.forEach(clearTimeout);
          s?.reject(new Error("The interviewer couldn't speak that line"));
          this.cb.onEvent("realtime_response_failed", { reason: String(ev.response?.status_details?.error?.code ?? "unknown") });
        } else if (this.speaking) {
          // Fallback in case the playback-stopped event never arrives.
          const words = (this.speaking.transcript || this.speaking.text).split(/\s+/).length;
          this.speaking.timers.push(setTimeout(() => this.finishSpeaking(), 2500 + words * 420));
        }
        break;
      }
      case "input_audio_buffer.speech_started":
        if (!this.listening) break;
        this.openSpeechStart = Date.now();
        if (ev.item_id) this.timing.set(ev.item_id, { startedAt: this.openSpeechStart, stoppedAt: null });
        this.cb.onSpeechStart();
        break;
      case "input_audio_buffer.speech_stopped":
        if (!this.listening) break;
        if (ev.item_id) this.timing.set(ev.item_id, { startedAt: this.timing.get(ev.item_id)?.startedAt ?? this.openSpeechStart, stoppedAt: Date.now() });
        this.openSpeechStart = null;
        this.cb.onSpeechStop();
        break;
      case "input_audio_buffer.committed":
        if (ev.item_id) {
          // A manual commit (flush) can arrive while speech is still open: close it here.
          if (!this.timing.get(ev.item_id)?.stoppedAt) {
            this.timing.set(ev.item_id, { startedAt: this.timing.get(ev.item_id)?.startedAt ?? this.openSpeechStart, stoppedAt: Date.now() });
            this.openSpeechStart = null;
          }
          this.pending.add(ev.item_id);
          this.cb.onPendingChange(this.pending.size);
        }
        this.awaitingCommit = false;
        this.wake();
        break;
      case "conversation.item.input_audio_transcription.completed": {
        this.pending.delete(ev.item_id);
        this.cb.onPendingChange(this.pending.size);
        const timing = this.timing.get(ev.item_id);
        this.timing.delete(ev.item_id);
        if (ev.transcript?.trim()) this.cb.onTranscript(ev.transcript.trim(), ev.item_id, timing);
        this.send({ type: "conversation.item.delete", item_id: ev.item_id });
        this.wake();
        break;
      }
      case "conversation.item.input_audio_transcription.failed":
        this.pending.delete(ev.item_id);
        this.timing.delete(ev.item_id);
        this.cb.onPendingChange(this.pending.size);
        this.cb.onEvent("transcription_failed", {});
        this.wake();
        break;
      case "error": {
        const code = String(ev.error?.code ?? "");
        // A flush with nothing new to send is fine: everything was already transcribed.
        if (code.includes("commit_empty")) { this.awaitingCommit = false; this.wake(); break; }
        if (this.awaitingCommit) { this.awaitingCommit = false; this.wake(); }
        // Deleting an already-removed item is harmless; ignore that noise.
        if (code !== "item_not_found") this.cb.onEvent("realtime_error", { code, message: String(ev.error?.message ?? "").slice(0, 300) });
        break;
      }
    }
  }

  speak(text: string) {
    return new Promise<{ transcript: string }>((resolve, reject) => {
      this.speaking = { resolve, reject, transcript: "", text, timers: [] };
      this.speaking.timers.push(setTimeout(() => this.finishSpeaking(), 90_000));
      this.send({ type: "response.create", response: { instructions: speakInstruction(text) } });
    });
  }

  startListening() {
    this.listening = true;
    this.mic.enabled = true;
  }

  private wake() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((r) => r());
  }

  async flush(timeoutMs = 10_000) {
    if (!this.listening || this.dc?.readyState !== "open") return { timedOut: false };
    const deadline = Date.now() + timeoutMs;
    await sleep(FLUSH_TAIL_MS);
    this.awaitingCommit = true;
    this.send({ type: "input_audio_buffer.commit" });
    const settled = () => !this.awaitingCommit && this.pending.size === 0;
    while (!settled() && Date.now() < deadline) {
      await new Promise<void>((r) => { this.waiters.push(r); setTimeout(r, 250); });
    }
    const timedOut = !settled();
    this.awaitingCommit = false;
    if (timedOut) this.cb.onEvent("transcript_flush_timeout", { pending: this.pending.size });
    return { timedOut };
  }

  stopListening() {
    this.listening = false;
    this.mic.enabled = false;
    this.openSpeechStart = null;
    this.send({ type: "input_audio_buffer.clear" });
  }

  close() {
    this.speaking?.timers.forEach(clearTimeout);
    this.speaking = null;
    try { this.dc?.close(); } catch { /* noop */ }
    try { this.pc?.close(); } catch { /* noop */ }
    this.mic.stop();
    if (this.audio) this.audio.srcObject = null;
  }
}

/**
 * Demo-mode engine (no OpenAI key): the browser's speech synthesis voices the
 * interviewer; the candidate types (or dictates) answers.
 */
export class BrowserVoice implements VoiceEngine {
  readonly kind = "browser" as const;
  constructor(private cb: VoiceCallbacks) {}
  async connect() {
    this.cb.onConnection("connected");
  }
  speak(text: string) {
    return new Promise<{ transcript: string }>((resolve) => {
      const done = () => resolve({ transcript: text });
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return setTimeout(done, 1500);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      let fallback = setTimeout(done, 2000 + text.split(/\s+/).length * 450);
      // Browsers without speech output (e.g. headless) never fire onstart: don't make the candidate wait.
      const noVoice = setTimeout(() => { clearTimeout(fallback); fallback = setTimeout(done, 300); }, 2500);
      u.onstart = () => clearTimeout(noVoice);
      u.onend = () => { clearTimeout(fallback); clearTimeout(noVoice); done(); };
      u.onerror = () => { clearTimeout(fallback); clearTimeout(noVoice); done(); };
      window.speechSynthesis.speak(u);
    });
  }
  startListening() {}
  async flush() { return { timedOut: false }; }
  stopListening() {}
  close() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}
