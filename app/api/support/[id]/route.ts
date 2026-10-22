import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { CustomerStatusSchema, setMyTicketStatus } from "@/lib/services/support";

/** Mark a request resolved, or open it again. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth();
  await setMyTicketStatus(auth, uuidParam(id), (await body(req, CustomerStatusSchema)).status);
  return { ok: true };
});
