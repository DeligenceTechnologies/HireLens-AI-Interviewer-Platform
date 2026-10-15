import { ApiError, route, uuidParam } from "@/lib/api";
import { readLogo } from "@/lib/services/branding";

/** A company's logo for candidate pages. URLs are versioned (?v=), so they can be cached for good. */
export const GET = route<{ orgId: string }>(async (_req, { orgId }) => {
  const logo = await readLogo(uuidParam(orgId));
  if (!logo) throw new ApiError(404, "Not found");
  return new Response(Buffer.from(logo.bytes), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
