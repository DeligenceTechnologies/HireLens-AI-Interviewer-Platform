import { route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { revokeCompanyMemberInvite } from "@/lib/services/admin";

export const DELETE = route<{ id: string; inviteId: string }>(async (_req, { id, inviteId }) => {
  const admin = await requirePlatformAdminApi();
  await revokeCompanyMemberInvite(admin.userId, uuidParam(id), uuidParam(inviteId));
  return { ok: true };
});
