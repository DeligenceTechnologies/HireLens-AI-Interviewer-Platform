import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { AdminReplySchema, adminUpdateTicket } from "@/lib/services/support";

/** Reply to a support request and/or change its status. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  await adminUpdateTicket(admin.userId, uuidParam(id), await body(req, AdminReplySchema));
  return { ok: true };
});
