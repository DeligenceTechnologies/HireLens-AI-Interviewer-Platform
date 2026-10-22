import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { updateAccessRequest } from "@/lib/services/admin";

const Schema = z.object({
  status: z.enum(["new", "contacted", "approved", "rejected", "closed"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  await updateAccessRequest(admin.userId, uuidParam(id), await body(req, Schema));
  return { ok: true };
});
