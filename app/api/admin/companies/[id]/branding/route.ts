import { route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { deleteLogo, updateColor, uploadLogo } from "@/lib/branding-api";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  return uploadLogo(req, uuidParam(id), { userId: admin.userId, platformAdmin: true });
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  return updateColor(req, uuidParam(id), { userId: admin.userId, platformAdmin: true });
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const admin = await requirePlatformAdminApi();
  return deleteLogo(uuidParam(id), { userId: admin.userId, platformAdmin: true });
});
