import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSystem } from "@/lib/database/db";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { FACE_CONSENT_VERSION, CONSENT_VERSION, getPublicInterview } from "@/lib/interview/controller";
import { faceImageResponse, getFaceReference, getFaceVerification, recordFaceCheck, saveFaceReference } from "@/lib/interview/face";
import { deleteInterviewData } from "@/lib/services/workspace";
import { storage } from "@/lib/storage";

// Face verification against the local database and storage, with a throwaway company.
const id = Date.now().toString(36);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const descriptor = Array.from({ length: 128 }, (_, i) => (i % 7) / 10);
let orgId = "";
let n = 0;

async function interview(opts: { face: boolean; consentVersion?: string | null; status?: string; started?: boolean }) {
  n += 1;
  const token = generateToken();
  const ivId = await withSystem(async (tx) => {
    const [j] = await tx<{ id: string }[]>`insert into jobs (organization_id, title, status, face_verification) values (${orgId}, 'Face job', 'active', ${opts.face}) returning id`;
    const [c] = await tx<{ id: string }[]>`insert into candidates (organization_id, name, email) values (${orgId}, ${`Cand ${n}`}, ${`c${n}-${id}@face.test`}) returning id`;
    const [iv] = await tx<{ id: string }[]>`
      insert into interviews (organization_id, job_id, candidate_id, secure_token_hash, status, consent_given, consent_version, started_at, face_verification)
      values (${orgId}, ${j.id}, ${c.id}, ${hashToken(token)}, ${opts.status ?? "device_check"}::interview_status, ${opts.consentVersion !== null},
        ${opts.consentVersion === undefined ? FACE_CONSENT_VERSION : opts.consentVersion}, ${opts.started ? new Date(Date.now() - 60_000) : null}, ${!!opts.started && opts.face})
      returning id`;
    return iv.id;
  });
  return { token, ivId };
}

beforeAll(async () => {
  const [o] = await withSystem((tx) => tx<{ id: string }[]>`insert into organizations (name, slug) values (${`Face Co ${id}`}, ${`face-co-${id}`}) returning id`);
  orgId = o.id;
});

afterAll(async () => {
  await storage().deletePrefix(`${orgId}/`).catch(() => {});
  await withSystem((tx) => tx`delete from organizations where id = ${orgId}`);
});

describe("face verification", () => {
  it("asks for the identity-check consent when the job uses it", async () => {
    const old = await interview({ face: true, consentVersion: CONSENT_VERSION });
    const pub = await getPublicInterview(old.token);
    expect(pub.face_verification).toBe(true);
    expect(pub.consent_version).toBe(FACE_CONSENT_VERSION);
    expect(pub.consent_given).toBe(false);
    await expect(saveFaceReference(old.token, { descriptor, image: jpeg })).rejects.toThrow(/consent/);

    const off = await interview({ face: false, consentVersion: CONSENT_VERSION });
    expect((await getPublicInterview(off.token)).consent_given).toBe(true);
    await expect(saveFaceReference(off.token, { descriptor, image: jpeg })).rejects.toThrow(/isn't used/);
  });

  it("stores the reference, replaces it on retake, and rejects non-JPEG photos", async () => {
    const { token, ivId } = await interview({ face: true });
    await expect(saveFaceReference(token, { descriptor, image: new Uint8Array([1, 2, 3]) })).rejects.toThrow(/JPEG/);
    await saveFaceReference(token, { descriptor, image: jpeg });
    await saveFaceReference(token, { descriptor, image: jpeg });
    const face = await getFaceVerification(orgId, ivId);
    expect(face?.status).toBe("verified");
    expect(face?.checks.filter((c) => c.kind === "reference")).toHaveLength(1);
    expect((await storage().list(`${orgId}/interviews/${ivId}/face/`))).toHaveLength(1);
    expect((await getFaceReference(token)).descriptor).toEqual(descriptor);
  });

  it("keeps a photo for review when the device can't run the face model", async () => {
    const { token, ivId } = await interview({ face: true });
    await saveFaceReference(token, { descriptor: null, image: jpeg });
    expect((await getFaceVerification(orgId, ivId))?.status).toBe("needs_review");
  });

  it("records flags during the interview and serves photos only within the company", async () => {
    const { token, ivId } = await interview({ face: true, status: "in_progress", started: true });
    await withSystem((tx) => tx`insert into face_checks (organization_id, interview_id, kind) values (${orgId}, ${ivId}, 'reference')`);
    await recordFaceCheck(token, { kind: "check_in", distance: 0.3, image: jpeg });
    await recordFaceCheck(token, { kind: "mismatch", distance: 0.8, image: jpeg });
    const face = await getFaceVerification(orgId, ivId);
    expect(face?.status).toBe("mismatch");
    const flag = face!.checks.find((c) => c.kind === "mismatch")!;
    expect(flag.offset_ms).toBeGreaterThanOrEqual(59_000);
    const res = await faceImageResponse(orgId, ivId, flag.id);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const [other] = await withSystem((tx) => tx<{ id: string }[]>`insert into organizations (name, slug) values (${`Other ${id}`}, ${`other-face-${id}`}) returning id`);
    await expect(faceImageResponse(other.id, ivId, flag.id)).rejects.toThrow(/not found/i);
    await withSystem((tx) => tx`delete from organizations where id = ${other.id}`);
  });

  it("deletes face photos and data with the recording", async () => {
    const { token, ivId } = await interview({ face: true });
    await saveFaceReference(token, { descriptor, image: jpeg });
    await deleteInterviewData(orgId, null, ivId, "recording");
    const face = await getFaceVerification(orgId, ivId);
    expect(face?.checks).toHaveLength(0);
    expect(await storage().list(`${orgId}/interviews/${ivId}/face/`)).toHaveLength(0);
    const [row] = await withSystem((tx) => tx<{ face_descriptor: unknown }[]>`select face_descriptor from interviews where id = ${ivId}`);
    expect(row.face_descriptor).toBeNull();
  });
});
