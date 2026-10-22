import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { saveScorecard, ScorecardSchema } from "@/lib/services/human-interviews";

/** Save or submit the signed-in interviewer's scorecard. */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("scorecard:write");
  await saveScorecard(auth.orgId, auth.userId, uuidParam(id), await body(req, ScorecardSchema));
  return { ok: true };
});
