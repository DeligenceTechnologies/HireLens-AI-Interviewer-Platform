import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { createTicket, CreateTicketSchema } from "@/lib/services/support";

/** A signed-in customer writes to PickMyHire.ai support. */
export const POST = route(async (req) => {
  const auth = await requireApiAuth();
  return createTicket(auth, await body(req, CreateTicketSchema));
}, { rateLimit: { key: "support-create", limit: 20, windowMs: 60 * 60_000 } });
