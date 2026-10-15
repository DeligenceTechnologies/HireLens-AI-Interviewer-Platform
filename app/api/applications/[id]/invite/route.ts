import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { inviteApplicant } from "@/lib/services/applications";
import { RoundChoiceSchema } from "@/lib/validation/rounds";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("interview:write");
  const { sendInvite, ...round } = await body(req, RoundChoiceSchema.extend({ sendInvite: z.boolean().default(true) }));
  return inviteApplicant(auth.orgId, auth.userId, uuidParam(id), sendInvite, round);
});
