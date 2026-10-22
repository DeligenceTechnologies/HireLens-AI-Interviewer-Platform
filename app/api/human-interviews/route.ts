import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { CreateHumanSchema, scheduleHumanInterview } from "@/lib/services/human-interviews";

/** Schedule a human interview for a job's human round. */
export const POST = route(async (req) => {
  const auth = await requireApiAuth("interview:write");
  return scheduleHumanInterview(auth.orgId, auth.userId, await body(req, CreateHumanSchema));
});
