import "server-only";
// Face verification. The candidate's browser runs the face model; the server
// stores the reference descriptor, the photos and the flags, and serves them to
// recruiters. Photos live under the interview's storage prefix, so they're
// removed with the interview's other media.

import { z } from "zod";
import { json, withOrg, type Tx } from "@/lib/database/db";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { paths, storage } from "@/lib/storage";
import { resolveToken } from "./controller";
import { FACE_DESCRIPTOR_LENGTH, MAX_FACE_IMAGE_BYTES, MAX_FACE_IMAGES, faceStatus, type FaceCheckKind } from "./face-rules";

const Descriptor = z.array(z.number().finite().min(-2).max(2)).length(FACE_DESCRIPTOR_LENGTH);
export const FaceReferenceMeta = z.object({ descriptor: Descriptor.nullable() });
export const FaceCheckMeta = z.object({
  kind: z.enum(["check_in", "mismatch", "no_face", "multiple_faces", "detector_unavailable"]),
  distance: z.number().finite().min(0).max(4).nullable(),
});

const PRE_START = ["created", "invited", "consent_pending", "device_check", "ready"];
const ACTIVE = ["in_progress", "completing"];

export const facePaths = {
  prefix: (orgId: string, interviewId: string) => `${paths.interviewPrefix(orgId, interviewId)}face/`,
  image: (orgId: string, interviewId: string, id: string) => `${paths.interviewPrefix(orgId, interviewId)}face/${id}.jpg`,
};

function assertJpeg(bytes: Uint8Array | null) {
  if (!bytes) return;
  if (bytes.byteLength > MAX_FACE_IMAGE_BYTES) throw new ApiError(413, "Photo too large.");
  if (bytes.byteLength < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ApiError(415, "Photo must be a JPEG.");
}

export async function hasFaceReference(ctx: { id: string; orgId: string }) {
  const [row] = await withOrg(ctx.orgId, (tx) => tx`select 1 from face_checks where interview_id = ${ctx.id} and kind = 'reference' limit 1`);
  return !!row;
}

/**
 * Save (or retake) the reference selfie at the setup check. `descriptor` is null
 * when the candidate's browser couldn't run the face model: the photo is still
 * kept so a recruiter can compare by eye.
 */
export async function saveFaceReference(token: string, input: { descriptor: number[] | null; image: Uint8Array }) {
  const ctx = await resolveToken(token);
  if (!ctx.faceVerification) throw new ApiError(409, "Identity check isn't used for this interview.");
  if (!ctx.consentGiven) throw new ApiError(409, "Please give consent first.");
  if (!PRE_START.includes(ctx.status)) throw new ApiError(409, "The interview has already started.");
  assertJpeg(input.image);
  const id = crypto.randomUUID();
  const path = facePaths.image(ctx.orgId, ctx.id, id);
  await storage().put(path, input.image, "image/jpeg");
  const old = await withOrg(ctx.orgId, async (tx) => {
    const prev = await tx<{ image_path: string | null }[]>`delete from face_checks where interview_id = ${ctx.id} and kind in ('reference', 'detector_unavailable') returning image_path`;
    await tx`insert into face_checks (id, organization_id, interview_id, kind, image_path) values (${id}, ${ctx.orgId}, ${ctx.id}, 'reference', ${path})`;
    if (!input.descriptor) {
      await tx`insert into face_checks (organization_id, interview_id, kind) values (${ctx.orgId}, ${ctx.id}, 'detector_unavailable')`;
    }
    await tx`update interviews set face_verification = true, face_descriptor = ${input.descriptor ? json(input.descriptor) : null} where id = ${ctx.id}`;
    await audit(tx, { orgId: ctx.orgId, actorType: "candidate", action: "interview.face_reference_saved", entityType: "interview", entityId: ctx.id, metadata: { automatic: !!input.descriptor } });
    return prev;
  });
  for (const p of old) if (p.image_path) await storage().delete(p.image_path).catch(() => {});
  return { saved: true };
}

/** The reference descriptor for the live interview's checks (null = checks can't run). */
export async function getFaceReference(token: string) {
  const ctx = await resolveToken(token);
  if (!ctx.faceVerification) return { enabled: false, descriptor: null };
  const [row] = await withOrg(ctx.orgId, (tx) => tx<{ face_descriptor: number[] | null }[]>`select face_descriptor from interviews where id = ${ctx.id}`);
  return { enabled: true, descriptor: row?.face_descriptor ?? null };
}

/** A flag or check-in from the live interview, with an optional photo. */
export async function recordFaceCheck(token: string, input: { kind: Exclude<FaceCheckKind, "reference">; distance: number | null; image: Uint8Array | null }) {
  const ctx = await resolveToken(token);
  if (!ctx.faceVerification) throw new ApiError(409, "Identity check isn't used for this interview.");
  if (!ACTIVE.includes(ctx.status)) throw new ApiError(409, "The interview is not in progress.");
  assertJpeg(input.image);
  const offsetMs = ctx.startedAt ? Math.max(0, Date.now() - ctx.startedAt.getTime()) : null;
  const id = crypto.randomUUID();
  const [{ images }] = await withOrg(ctx.orgId, (tx) => tx<{ images: number }[]>`
    select count(*)::int as images from face_checks where interview_id = ${ctx.id} and image_path is not null`);
  const path = input.image && images < MAX_FACE_IMAGES ? facePaths.image(ctx.orgId, ctx.id, id) : null;
  if (path && input.image) await storage().put(path, input.image, "image/jpeg");
  await withOrg(ctx.orgId, async (tx) => {
    await tx`insert into face_checks (id, organization_id, interview_id, kind, distance, offset_ms, image_path)
      values (${id}, ${ctx.orgId}, ${ctx.id}, ${input.kind}, ${input.distance}, ${offsetMs}, ${path})`;
  });
  return { saved: true };
}

export type FaceCheckRow = { id: string; kind: FaceCheckKind; distance: number | null; offset_ms: number | null; has_image: boolean; created_at: Date };

/** Face verification summary for the recruiter's interview page (null when not used). */
export async function getFaceVerification(orgId: string, interviewId: string) {
  return withOrg(orgId, async (tx) => {
    const [iv] = await tx<{ face_verification: boolean }[]>`select face_verification from interviews where id = ${interviewId} and organization_id = ${orgId}`;
    if (!iv?.face_verification) return null;
    const checks = await tx<FaceCheckRow[]>`
      select id, kind, distance, offset_ms, image_path is not null as has_image, created_at
      from face_checks where interview_id = ${interviewId} order by kind = 'reference' desc, created_at`;
    return { status: faceStatus(checks), checks };
  });
}

/** One face photo, for authorized recruiters. */
export async function faceImageResponse(orgId: string, interviewId: string, checkId: string): Promise<Response> {
  const [row] = await withOrg(orgId, (tx) => tx<{ image_path: string | null }[]>`
    select image_path from face_checks where id = ${checkId} and interview_id = ${interviewId} and organization_id = ${orgId}`);
  if (!row?.image_path) throw new ApiError(404, "Photo not found");
  const bytes = await storage().get(row.image_path);
  return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}

/** Remove face photos, flags and the descriptor (with the recording, or on full deletion). */
export async function deleteFaceDataTx(tx: Tx, interviewId: string) {
  await tx`delete from face_checks where interview_id = ${interviewId}`;
  await tx`update interviews set face_descriptor = null where id = ${interviewId}`;
}

/** Parse a face upload: multipart with a `meta` JSON field and an optional `image` JPEG. */
export async function readFaceUpload<S extends z.ZodType>(req: Request, schema: S): Promise<{ meta: z.infer<S>; image: Uint8Array | null }> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_FACE_IMAGE_BYTES + 20_000) throw new ApiError(413, "Photo too large.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Invalid upload");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("meta") ?? ""));
  } catch {
    throw new ApiError(400, "Invalid upload");
  }
  const file = form.get("image");
  const image = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : null;
  return { meta: schema.parse(raw), image };
}
