import { describe, expect, it } from "vitest";
import { isWirelessMic, recordingProblem, TIMESLICE_MS } from "@/components/interview/session/recording-health";

const every = (ms: number, n: number, from = 0) => Array.from({ length: n }, (_, i) => from + (i + 1) * ms);

describe("recordingProblem", () => {
  it("accepts a recorder keeping pace with real time", () => {
    const chunkTimes = every(TIMESLICE_MS, 10);
    expect(recordingProblem({ startedAt: 0, chunkTimes, now: chunkTimes.at(-1)! + 1000 })).toBeNull();
  });

  it("tolerates normal jitter", () => {
    const chunkTimes = [4100, 7900, 12300, 15800, 20400];
    expect(recordingProblem({ startedAt: 0, chunkTimes, now: 21000 })).toBeNull();
  });

  it("flags a recording running at half speed (a piece every 8 s instead of 4 s)", () => {
    const chunkTimes = every(8000, 6);
    expect(recordingProblem({ startedAt: 0, chunkTimes, now: chunkTimes.at(-1)! + 1000 })).toBe("slow");
  });

  it("waits for enough pieces before judging the pace", () => {
    const chunkTimes = every(8000, 3);
    expect(recordingProblem({ startedAt: 0, chunkTimes, now: chunkTimes.at(-1)! + 1000 })).toBeNull();
  });

  it("flags a recorder that stopped delivering", () => {
    expect(recordingProblem({ startedAt: 0, chunkTimes: every(TIMESLICE_MS, 3), now: 12_000 + TIMESLICE_MS * 3 + 1 })).toBe("stalled");
    expect(recordingProblem({ startedAt: 0, chunkTimes: [], now: TIMESLICE_MS * 3 + 1 })).toBe("stalled");
  });

  it("works for the device check's 1-second test slices", () => {
    expect(recordingProblem({ startedAt: 0, chunkTimes: every(1000, 5), now: 5500, sliceMs: 1000 })).toBeNull();
    expect(recordingProblem({ startedAt: 0, chunkTimes: every(2000, 5), now: 10_500, sliceMs: 1000 })).toBe("slow");
  });
});

describe("isWirelessMic", () => {
  it("recognises common wireless headsets", () => {
    for (const l of ["AirPods Pro", "Galaxy Buds2", "Headset (Jabra Evolve2 Hands-Free)", "Bose QC45", "WH-1000XM5 Bluetooth"]) expect(isWirelessMic(l)).toBe(true);
  });
  it("leaves wired and built-in microphones alone", () => {
    for (const l of ["MacBook Pro Microphone (Built-in)", "External Microphone", "USB Audio Device", "Default - Microphone Array (Realtek)"]) expect(isWirelessMic(l)).toBe(false);
  });
});
