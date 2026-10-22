import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { STAGES } from "@/lib/hiring";
import { setStage } from "@/lib/services/pipeline";

const Schema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  stage: z.enum(STAGES),
  note: z.string().trim().max(1000).nullable().optional(),
});

/** Move a candidate to a new stage for a job (Shortlisted, Hired, Rejected…). */
export const POST = route(async (req) => {
  const auth = await requireApiAuth("decision:write");
  await setStage(auth.orgId, auth.userId, await body(req, Schema));
  return { ok: true };
});
