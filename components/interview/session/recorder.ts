"use client";

// Records one track of the interview and uploads it in numbered chunks with
// retry. Never reports the recording as saved until the server confirms.
//   - "candidate": camera + microphone (the video)
//   - "interviewer": the AI interviewer's voice, played in sync on review
//
// Tracks go to MediaRecorder directly. (Mixing audio through an AudioContext
// tied the recording's clock to the sound output device; on some machines that
// clock ran at half speed and the saved video came out half as long as the
// interview.) A watchdog restarts the recorder as a new part if it stalls or
// falls behind real time; parts play back in order.

import { recordingProblem, TIMESLICE_MS } from "./recording-health";

export type UploadStatus = { state: "idle" | "recording" | "uploading" | "retrying" | "saved" | "failed"; pending: number; uploaded: number };
type EventFn = (type: string, payload?: Record<string, string | number | boolean | null>) => void;

const WATCHDOG_MS = 5000;
const MAX_RESTARTS = 5;

export type RecordingTrack = "candidate" | "interviewer";

function pickMime(track: RecordingTrack): string {
  const candidates = track === "interviewer"
    ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
    : ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

type Part = {
  part: number;
  next: number;
  recorder: MediaRecorder;
  stopped: Promise<void>;
  startedAt: number;
  endedAt: number | null;
  chunkTimes: number[];
};

export class InterviewRecorder {
  private parts: Part[] = [];
  private queue: { part: number; index: number; blob: Blob; attempts: number }[] = [];
  private uploaded = 0;
  private working = false;
  private stream: MediaStream | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private restarts = 0;
  private restarting = false;
  private finished = false;

  private track: RecordingTrack;

  constructor(private token: string, private onStatus: (s: UploadStatus) => void, private opts: { clock: () => number; onEvent?: EventFn; track?: RecordingTrack }) {
    this.track = opts.track ?? "candidate";
  }

  private get current() { return this.parts.at(-1); }

  private emit(state?: UploadStatus["state"]) {
    const s = state ?? (this.queue.length ? "uploading" : this.current?.recorder.state === "recording" ? "recording" : "idle");
    this.onStatus({ state: s, pending: this.queue.length, uploaded: this.uploaded });
  }

  async start(stream: MediaStream) {
    this.stream = stream;
    await this.startPart();
    this.watchdog = setInterval(() => this.check(), WATCHDOG_MS);
  }

  private async startPart() {
    const tracks = this.stream!.getTracks().filter((t) => t.readyState === "live");
    if (!tracks.length) throw new Error("No live camera or microphone");
    const mime = pickMime(this.track);
    const res = await fetch(`/api/public/interview/${this.token}/recording`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset_ms: Math.round(this.opts.clock()), mime_type: mime || (this.track === "interviewer" ? "audio/webm" : "video/webm"), track: this.track }),
    });
    if (!res.ok) throw new Error("Could not start recording");
    const partIndex: number = (await res.json()).part_index;

    const bitrates = this.track === "interviewer" ? { audioBitsPerSecond: 48_000 } : { videoBitsPerSecond: 350_000, audioBitsPerSecond: 64_000 };
    const recorder = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), ...bitrates });
    const p: Part = { part: partIndex, next: 0, recorder, stopped: Promise.resolve(), startedAt: performance.now(), endedAt: null, chunkTimes: [] };
    p.stopped = new Promise((resolve) => { recorder.onstop = () => { p.endedAt = performance.now(); resolve(); }; });
    recorder.ondataavailable = (e) => {
      p.chunkTimes.push(performance.now());
      if (e.data.size > 0) {
        this.queue.push({ part: p.part, index: p.next++, blob: e.data, attempts: 0 });
        void this.pump();
      }
    };
    recorder.onerror = () => void this.restart("recorder_error");
    this.parts.push(p);
    recorder.start(TIMESLICE_MS);
    this.emit("recording");
  }

  /** Watchdog: restart if the recorder stopped, stalled or fell behind real time. */
  private check() {
    const p = this.current;
    if (!p || this.restarting || this.finished) return;
    // A dead microphone/camera is handled by the session (it switches device and calls useStream).
    if (this.stream?.getTracks().some((t) => t.readyState === "ended")) return;
    const problem = p.recorder.state === "inactive" ? "stopped" : recordingProblem({ startedAt: p.startedAt, chunkTimes: p.chunkTimes, now: performance.now() });
    if (problem) void this.restart(problem);
  }

  /** Continue recording from a new stream (e.g. after a microphone switch). */
  async useStream(stream: MediaStream) {
    this.stream = stream;
    await this.restart("device_switched", true);
  }

  private async restart(reason: string, force = false) {
    if (this.restarting || this.finished) return;
    if (!force && this.restarts >= MAX_RESTARTS) return;
    this.restarting = true;
    this.restarts++;
    const old = this.current;
    this.opts.onEvent?.("recording_restarted", { reason, track: this.track, part: old?.part ?? null });
    try {
      // Start the new part before stopping the old one, so nothing is lost in between.
      await this.startPart();
      if (old && old.recorder.state !== "inactive") old.recorder.stop();
    } catch {
      this.opts.onEvent?.("recording_restart_failed", { reason, track: this.track });
    } finally {
      this.restarting = false;
    }
  }

  private async pump() {
    if (this.working) return;
    this.working = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        this.emit();
        try {
          const r = await fetch(`/api/public/interview/${this.token}/recording/${item.part}/chunk/${item.index}`, { method: "PUT", body: item.blob });
          if (!r.ok && r.status !== 409) throw new Error(`HTTP ${r.status}`);
          this.queue.shift();
          this.uploaded++;
        } catch {
          item.attempts++;
          this.emit("retrying");
          await new Promise((r) => setTimeout(r, Math.min(15_000, 1000 * 2 ** Math.min(item.attempts, 4))));
        }
      }
    } finally {
      this.working = false;
      this.emit();
    }
  }

  /** Stop recording, upload what's left, and confirm every part with the server. */
  async finish(timeoutMs = 25_000): Promise<boolean> {
    if (!this.parts.length) return false;
    this.finished = true;
    if (this.watchdog) clearInterval(this.watchdog);
    for (const p of this.parts) if (p.recorder.state !== "inactive") p.recorder.stop();
    await Promise.race([Promise.all(this.parts.map((p) => p.stopped)), new Promise((r) => setTimeout(r, 3000))]);
    const deadline = Date.now() + timeoutMs;
    while ((this.queue.length || this.working) && Date.now() < deadline) {
      void this.pump();
      await new Promise((r) => setTimeout(r, 300));
    }
    if (this.queue.length) { this.emit("failed"); return false; }
    let ok = true;
    for (const p of this.parts) ok = (await this.finalize(p)) && ok;
    this.emit(ok ? "saved" : "failed");
    return ok;
  }

  private async finalize(p: Part) {
    if (p.next === 0) return true; // replaced before it recorded anything
    const durationMs = (p.endedAt ?? performance.now()) - p.startedAt;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(`/api/public/interview/${this.token}/recording/${p.part}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration_ms: Math.round(durationMs), total_chunks: p.next }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.status === "stored") return true;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    return false;
  }
}
