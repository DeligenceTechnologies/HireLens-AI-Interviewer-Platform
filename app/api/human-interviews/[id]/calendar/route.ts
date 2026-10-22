import { ApiError, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { calendarFile, getHumanInterview } from "@/lib/services/human-interviews";

/** Calendar invite (.ics) for the candidate or the interview team. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("interview:view");
  const h = await getHumanInterview(auth.orgId, uuidParam(id), auth);
  if (!h) throw new ApiError(404, "Interview not found");
  const audience = new URL(req.url).searchParams.get("for") === "team" ? "team" : "candidate";
  const name = `${h.round_name}-${h.candidate_name}`.replace(/[^\w-]+/g, "-").slice(0, 60);
  return new Response(calendarFile(h, audience), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.ics"`, "Cache-Control": "no-store" },
  });
});
