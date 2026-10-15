import { route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { deleteLogo, updateColor, uploadLogo } from "@/lib/branding-api";
import { getBrand } from "@/lib/services/branding";

export const GET = route(async () => {
  const auth = await requireApiAuth("branding:manage");
  return getBrand(auth.orgId);
});

/** Upload or replace the company logo (multipart field "file"). */
export const POST = route(async (req) => {
  const auth = await requireApiAuth("branding:manage");
  return uploadLogo(req, auth.orgId, { userId: auth.userId });
}, { rateLimit: { key: "logo-upload", limit: 20, windowMs: 60 * 60_000 } });

export const PATCH = route(async (req) => {
  const auth = await requireApiAuth("branding:manage");
  return updateColor(req, auth.orgId, { userId: auth.userId });
});

export const DELETE = route(async () => {
  const auth = await requireApiAuth("branding:manage");
  return deleteLogo(auth.orgId, { userId: auth.userId });
});
