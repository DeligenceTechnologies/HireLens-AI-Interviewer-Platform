import { body, route } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { createCompanyInvite } from "@/lib/services/admin";
import { CompanyInviteSchema } from "@/lib/validation/admin";

/** Create a company yourself: returns the owner's one-time sign-up link. */
export const POST = route(async (req) => {
  const admin = await requirePlatformAdminApi();
  return createCompanyInvite(admin.userId, await body(req, CompanyInviteSchema));
});
