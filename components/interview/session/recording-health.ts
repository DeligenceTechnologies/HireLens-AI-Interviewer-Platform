// Shared check for "is this recording keeping up with real time?". Used by the
// live recorder's watchdog and by the device check's test recording.

/** The recorder hands over a piece every this many ms of *recorded* time. */
export const TIMESLICE_MS = 4000;

export type RecordingProblem = "stalled" | "slow";

/**
 * MediaRecorder delivers a piece every `sliceMs` of recorded time. If pieces
 * arrive much slower than that in real time, the recording clock is behind
 * (the saved file comes out shorter than the interview); if none arrive at
 * all, the recorder has stalled.
 */
export function recordingProblem(s: { startedAt: number; chunkTimes: number[]; now: number; sliceMs?: number }): RecordingProblem | null {
  const slice = s.sliceMs ?? TIMESLICE_MS;
  const last = s.chunkTimes.at(-1) ?? s.startedAt;
  if (s.now - last > slice * 3) return "stalled";
  const recent = s.chunkTimes.slice(-5);
  if (recent.length === 5) {
    const avg = (recent[4] - recent[0]) / 4;
    if (avg > slice * 1.5) return "slow";
  }
  return null;
}

/** Wireless headsets work, but are the most common source of audio trouble. */
export function isWirelessMic(label: string) {
  return /bluetooth|airpods|buds|hands-?free|bose|jabra|jbl|beats|sony wh|sony wf/i.test(label);
}
