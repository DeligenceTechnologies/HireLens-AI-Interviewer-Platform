// Face verification rules shared by the candidate's browser (which runs the
// checks) and the server (which stores them and summarizes them for the report).
// Flags are for a person to review; nothing here rejects a candidate.

export const FACE_DESCRIPTOR_LENGTH = 128;
/** Distance between two descriptors above which they're treated as different people. */
export const FACE_MATCH_THRESHOLD = 0.6;
/** Seconds between checks during the interview. */
export const FACE_CHECK_INTERVAL_MS = 4000;
/** Consecutive checks a condition must hold before it's flagged (avoids one-frame glitches). */
export const FACE_FLAG_AFTER = { mismatch: 2, multiple_faces: 2, no_face: 3 } as const;
/** Random check-in photos taken during an interview. */
export const FACE_CHECK_INS = 3;
/** Most photos stored for one interview (flags + check-ins + the reference). */
export const MAX_FACE_IMAGES = 30;
export const MAX_FACE_IMAGE_BYTES = 300_000;

export type FaceCheckKind = "reference" | "check_in" | "mismatch" | "no_face" | "multiple_faces" | "detector_unavailable";
export type FaceFlagKind = "mismatch" | "no_face" | "multiple_faces";
export type FaceStatus = "verified" | "needs_review" | "mismatch" | "not_completed";

export function faceDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** Overall result for the report, from the stored checks. */
export function faceStatus(checks: { kind: FaceCheckKind }[]): FaceStatus {
  if (!checks.some((c) => c.kind === "reference")) return "not_completed";
  if (checks.some((c) => c.kind === "mismatch")) return "mismatch";
  if (checks.some((c) => c.kind === "no_face" || c.kind === "multiple_faces" || c.kind === "detector_unavailable")) return "needs_review";
  return "verified";
}

/**
 * Turns a stream of per-check observations into flags. A flag is raised once
 * per episode: after the condition holds for N checks in a row, and not again
 * until a clean check (one face that matches) ends the episode.
 */
export class FaceFlagTracker {
  private streak: Record<FaceFlagKind, number> = { mismatch: 0, no_face: 0, multiple_faces: 0 };
  private flagged = new Set<FaceFlagKind>();

  observe(faces: number, distance: number | null): FaceFlagKind | null {
    const kind: FaceFlagKind | null = faces === 0 ? "no_face" : faces > 1 ? "multiple_faces"
      : distance != null && distance > FACE_MATCH_THRESHOLD ? "mismatch" : null;
    for (const k of Object.keys(this.streak) as FaceFlagKind[]) if (k !== kind) this.streak[k] = 0;
    if (!kind) { this.flagged.clear(); return null; }
    this.streak[kind]++;
    if (this.streak[kind] >= FACE_FLAG_AFTER[kind] && !this.flagged.has(kind)) {
      this.flagged.add(kind);
      return kind;
    }
    return null;
  }
}
