import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { replyAsCustomer, ReplySchema } from "@/lib/services/support";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth();
  await replyAsCustomer(auth, uuidParam(id), (await body(req, ReplySchema)).message);
  return { ok: true };
}, { rateLimit: { key: "support-reply", limit: 60, windowMs: 60 * 60_000 } });
