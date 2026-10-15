import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { candidateRoundStates, listRounds } from "@/lib/services/rounds";
import { listTemplates } from "@/lib/services/templates";

/** The job's interview rounds (and, with ?candidateId, that candidate's progress in each) for the invite dialog. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("interview:write");
  const jobId = uuidParam(id);
  const candidateId = req.nextUrl.searchParams.get("candidateId");
  const [rounds, templates, states] = await Promise.all([
    listRounds(auth.orgId, jobId),
    listTemplates(auth.orgId),
    candidateId && isUuid(candidateId) ? candidateRoundStates(auth.orgId, jobId, candidateId) : Promise.resolve({}),
  ]);
  return {
    rounds,
    states,
    templates: templates.map((t) => ({ id: t.id, name: t.name, minutes: t.total_minutes })),
  };
});
