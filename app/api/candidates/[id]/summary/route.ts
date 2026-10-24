import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { buildCandidateSummary } from "@/lib/services/candidate-summary";
import { runInBackground } from "@/lib/background";

/** Retry the overall summary for a candidate who has cleared every round of a job. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("decision:write");
  const { job_id } = await body(req, z.object({ job_id: z.string().uuid() }));
  const candidateId = uuidParam(id);
  runInBackground("candidate.summary", () => buildCandidateSummary(auth.orgId, job_id, candidateId, true));
  return { ok: true };
}, { rateLimit: { key: "candidate-summary", limit: 10, windowMs: 60_000 } });
