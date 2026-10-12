import { route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { revokeCompanyInvite } from "@/lib/services/admin";

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const admin = await requirePlatformAdminApi();
  await revokeCompanyInvite(admin.userId, uuidParam(id));
  return { ok: true };
});
