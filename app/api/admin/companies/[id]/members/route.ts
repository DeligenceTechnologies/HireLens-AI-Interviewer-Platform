import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requirePlatformAdminApi } from "@/lib/auth/session";
import { addCompanyMember } from "@/lib/services/admin";

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "recruiter", "interviewer", "viewer"]),
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const admin = await requirePlatformAdminApi();
  const { email, role } = await body(req, Schema);
  return addCompanyMember(admin.userId, uuidParam(id), email, role);
});
