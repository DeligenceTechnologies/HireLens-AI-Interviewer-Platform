import { route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { createPasswordResetLink } from "@/lib/services/admin";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const admin = await requirePlatformAdminApi();
  return createPasswordResetLink(admin.userId, uuidParam(id));
});
