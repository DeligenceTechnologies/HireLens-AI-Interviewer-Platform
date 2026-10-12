import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { createCompanyInvite } from "@/lib/services/admin";
import { CompanyInviteSchema } from "@/lib/validation/admin";

/** Approve an access request: creates a one-time company sign-up link. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  const input = await body(req, CompanyInviteSchema);
  return createCompanyInvite(admin.userId, { ...input, accessRequestId: uuidParam(id) });
});
