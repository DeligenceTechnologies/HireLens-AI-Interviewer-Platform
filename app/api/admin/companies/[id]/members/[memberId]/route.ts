import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { changeCompanyMemberRole, removeCompanyMember } from "@/lib/services/admin";

export const PATCH = route<{ id: string; memberId: string }>(async (req, { id, memberId }) => {
  const admin = await requirePlatformAdminApi();
  const { role } = await body(req, z.object({ role: z.enum(["admin", "recruiter", "interviewer", "viewer"]) }));
  await changeCompanyMemberRole(admin.userId, uuidParam(id), uuidParam(memberId), role);
  return { ok: true };
});

export const DELETE = route<{ id: string; memberId: string }>(async (_req, { id, memberId }) => {
  const admin = await requirePlatformAdminApi();
  await removeCompanyMember(admin.userId, uuidParam(id), uuidParam(memberId));
  return { ok: true };
});
