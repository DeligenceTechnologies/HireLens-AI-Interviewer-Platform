import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { DECISIONS } from "@/lib/hiring";
import { setRoundDecision } from "@/lib/services/pipeline";

const Schema = z.object({ decision: z.enum(DECISIONS).nullable(), note: z.string().trim().max(1000).nullable().optional() });

/** Mark a human interview round Qualified / Not qualified / On hold (or clear it). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("decision:write");
  await setRoundDecision(auth.orgId, auth.userId, { kind: "human", id: uuidParam(id), ...(await body(req, Schema)) });
  return { ok: true };
});
