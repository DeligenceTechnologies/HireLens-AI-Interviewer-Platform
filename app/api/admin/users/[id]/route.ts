import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { setUserDisabled } from "@/lib/services/admin";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  const { disabled } = await body(req, z.object({ disabled: z.boolean() }));
  await setUserDisabled(admin.userId, uuidParam(id), disabled);
  return { ok: true };
});
