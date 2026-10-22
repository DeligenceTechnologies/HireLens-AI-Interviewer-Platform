import { route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { sendEmailVerification } from "@/lib/services/accounts";

/** Send the signed-in user a fresh email confirmation link. */
export const POST = route(async () => {
  const auth = await requireApiAuth();
  return sendEmailVerification(auth.userId);
}, { rateLimit: { key: "verify-email", limit: 5, windowMs: 60 * 60_000 } });
