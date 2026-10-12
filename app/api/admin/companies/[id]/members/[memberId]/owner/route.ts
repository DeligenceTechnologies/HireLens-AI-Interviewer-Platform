import { route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { transferCompanyOwnership } from "@/lib/services/admin";

export const POST = route<{ id: string; memberId: string }>(async (_req, { id, memberId }) => {
  const admin = await requirePlatformAdminApi();
  await transferCompanyOwnership(admin.userId, uuidParam(id), uuidParam(memberId));
  return { ok: true };
});
