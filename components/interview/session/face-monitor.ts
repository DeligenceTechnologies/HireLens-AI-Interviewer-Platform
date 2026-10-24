"use client";
// Identity check during the interview: every few seconds, compare the face in
// the camera with the reference photo from the setup check. Flags (with a
// photo) and a few random check-in photos go to the server for the hiring team.
// Runs entirely in the candidate's browser and never interrupts the interview.

import { useEffect, type RefObject } from "react";
import { loadFaceModel, scanFaces, snapshot, uploadFace } from "@/lib/client/face";
import { FACE_CHECK_INS, FACE_CHECK_INTERVAL_MS, FaceFlagTracker, faceDistance, type FaceCheckKind } from "@/lib/interview/face-rules";

/** Slowest acceptable scan; slower devices check less often so the interview stays smooth. */
const SLOW_SCAN_MS = 1500;
const MAX_INTERVAL_MS = 16_000;

export function useFaceMonitor({ token, active, video, onEvent }: {
  token: string;
  /** True while the interview is live. */
  active: boolean;
  video: RefObject<HTMLVideoElement | null>;
  onEvent: (type: string, payload?: Record<string, string | number | boolean | null>) => void;
}) {
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkInTimers: ReturnType<typeof setTimeout>[] = [];
    let lastDistance: number | null = null;

    const send = async (kind: Exclude<FaceCheckKind, "reference">, distance: number | null) => {
      const v = video.current;
      const image = v ? await snapshot(v) : null;
      if (stopped) return;
      await uploadFace(`/api/public/interview/${token}/face/check`, { kind, distance }, image)
        .catch(() => onEvent("face_check_upload_failed", { kind }));
    };

    (async () => {
      const ref = await fetch(`/api/public/interview/${token}/face`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() as Promise<{ enabled: boolean; descriptor: number[] | null }> : null))
        .catch(() => null);
      if (stopped || !ref?.enabled) return;

      // A few check-in photos at random moments: the first within 1–3 minutes, then every 4–8 minutes.
      let at = 0;
      for (let i = 0; i < FACE_CHECK_INS; i++) {
        at += (i === 0 ? 60_000 : 240_000) + Math.random() * 120_000 * (i === 0 ? 1 : 2);
        checkInTimers.push(setTimeout(() => void send("check_in", lastDistance), at));
      }

      let faceapi: Awaited<ReturnType<typeof loadFaceModel>>;
      try {
        faceapi = await loadFaceModel();
      } catch {
        onEvent("face_model_unavailable");
        return; // check-in photos still go to the hiring team
      }
      onEvent("face_monitor_started", { reference: !!ref.descriptor });
      const tracker = new FaceFlagTracker();
      let interval = FACE_CHECK_INTERVAL_MS;
      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        if (v) {
          try {
            const t0 = performance.now();
            const scan = await scanFaces(faceapi, v);
            const took = performance.now() - t0;
            if (took > SLOW_SCAN_MS && interval < MAX_INTERVAL_MS) {
              interval = Math.min(MAX_INTERVAL_MS, interval * 2);
              onEvent("face_monitor_slow", { scan_ms: Math.round(took), interval_ms: interval });
            }
            const distance = scan.descriptor && ref.descriptor ? faceDistance(scan.descriptor, ref.descriptor) : null;
            if (distance != null) lastDistance = Math.round(distance * 1000) / 1000;
            const flag = tracker.observe(scan.faces, distance);
            if (flag && !stopped) void send(flag, distance);
          } catch { /* a dropped frame: try again next time */ }
        }
        timer = setTimeout(tick, interval);
      };
      timer = setTimeout(tick, interval);
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      checkInTimers.forEach(clearTimeout);
    };
  }, [active, token, video, onEvent]);
}
