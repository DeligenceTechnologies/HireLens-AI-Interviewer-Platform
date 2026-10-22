import { z } from "zod";
import { body, route } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { savePlatformSettings } from "@/lib/services/admin";
import { QuotaSchema } from "@/lib/validation/admin";

const Schema = z.object({
  signupCodeEnabled: z.boolean(),
  signupCode: z.string().trim().max(100).nullable(),
  defaultQuota: QuotaSchema,
  trial: z.object({
    enabled: z.boolean(),
    interviews: z.number().int().min(1).max(50),
    days: z.number().int().min(1).max(90),
    requireVerification: z.boolean(),
  }),
});

export const PUT = route(async (req) => {
  const admin = await requirePlatformAdminApi();
  await savePlatformSettings(admin.userId, await body(req, Schema));
  return { ok: true };
});
