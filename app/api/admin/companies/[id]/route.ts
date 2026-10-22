import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { updateCompany } from "@/lib/services/admin";
import { QuotaSchema } from "@/lib/validation/admin";

const Schema = z.object({
  quota: QuotaSchema.optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["active", "suspended"]).optional(),
  extendTrialDays: z.number().int().min(1).max(90).optional(),
  convertTrial: z.literal(true).optional(),
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  await updateCompany(admin.userId, uuidParam(id), await body(req, Schema));
  return { ok: true };
});
