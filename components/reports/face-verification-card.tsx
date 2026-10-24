"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, PlayCircle, ScanFace, XCircle } from "lucide-react";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FACE_MATCH_THRESHOLD, type FaceCheckKind, type FaceStatus } from "@/lib/interview/face-rules";

export type FaceVerification = {
  status: FaceStatus;
  checks: { id: string; kind: FaceCheckKind; distance: number | null; offset_ms: number | null; has_image: boolean }[];
};

const STATUS: Record<FaceStatus, { label: string; detail: string; icon: typeof CheckCircle2; tone: string }> = {
  verified: { label: "Verified", detail: "The same face was seen throughout the interview.", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  needs_review: { label: "Needs review", detail: "Something was flagged (the candidate left the frame, someone else appeared, or automatic checks couldn't run). Look at the photos and the video.", icon: AlertTriangle, tone: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100" },
  mismatch: { label: "Possible mismatch", detail: "A face that didn't match the reference photo was seen. Compare the photos and watch those moments before deciding anything.", icon: XCircle, tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  not_completed: { label: "Not completed", detail: "No reference photo was taken for this interview.", icon: CircleDashed, tone: "bg-muted text-muted-foreground" },
};

const KIND: Record<FaceCheckKind, string> = {
  reference: "Reference photo",
  check_in: "Random check",
  mismatch: "Different face",
  no_face: "No face in view",
  multiple_faces: "More than one person",
  detector_unavailable: "Automatic checks unavailable",
};

function matchLabel(distance: number | null) {
  if (distance == null) return null;
  return distance <= FACE_MATCH_THRESHOLD - 0.15 ? "Strong match" : distance <= FACE_MATCH_THRESHOLD ? "Match" : "Doesn't match";
}

export function FaceVerificationCard({ interviewId, face, canViewPhotos, onJump }: {
  interviewId: string;
  face: FaceVerification;
  canViewPhotos: boolean;
  onJump: (ms: number) => void;
}) {
  const s = STATUS[face.status];
  const flags = face.checks.filter((c) => c.kind === "mismatch" || c.kind === "no_face" || c.kind === "multiple_faces").length;
  const shown = face.checks.filter((c) => c.kind !== "detector_unavailable");
  const unavailable = face.checks.some((c) => c.kind === "detector_unavailable");
  return (
    <section className="rounded-xl border bg-card" aria-labelledby="face-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <h3 id="face-title" className="flex items-center gap-2 font-semibold"><ScanFace className="size-4 text-primary" /> Identity check</h3>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.tone)}><s.icon className="size-3.5" />{s.label}{flags ? ` · ${flags} flag${flags === 1 ? "" : "s"}` : ""}</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">{s.detail}</p>
        {unavailable && <p className="text-sm text-muted-foreground">The candidate&apos;s device couldn&apos;t run automatic face checks, so only the photos are available to compare by eye.</p>}
        {shown.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((c) => {
              const match = c.kind === "reference" ? null : matchLabel(c.distance);
              const flagged = c.kind === "mismatch" || c.kind === "no_face" || c.kind === "multiple_faces";
              return (
                <li key={c.id} className="overflow-hidden rounded-lg border">
                  {c.has_image && canViewPhotos ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, authenticated photo
                    <img src={`/api/interviews/${interviewId}/face/${c.id}`} alt={KIND[c.kind]} loading="lazy" className="aspect-video w-full bg-muted object-cover -scale-x-100" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">{c.has_image ? "No access to photos" : "No photo"}</div>
                  )}
                  <div className="space-y-0.5 px-2.5 py-2">
                    <p className={cn("text-xs font-medium", flagged && "text-amber-700 dark:text-amber-400")}>{KIND[c.kind]}</p>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{match ?? (c.kind === "reference" ? "Setup check" : "")}</span>
                      {c.offset_ms != null && (
                        <button type="button" onClick={() => onJump(c.offset_ms!)} className="inline-flex items-center gap-1 rounded px-1 font-medium text-primary hover:bg-accent">
                          <PlayCircle className="size-3.5" /><span className="font-mono tabular">{formatClock(c.offset_ms)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Automatic face comparison can be wrong, for example with poor lighting, a new hairstyle or glasses. It&apos;s a prompt to review, never a decision.</p>
      </div>
    </section>
  );
}
