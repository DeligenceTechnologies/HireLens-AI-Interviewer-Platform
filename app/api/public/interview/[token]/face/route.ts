import { route } from "@/lib/api";
import { getFaceReference } from "@/lib/interview/face";

export const GET = route<{ token: string }>(async (_req, { token }) => getFaceReference(token),
  { rateLimit: { key: "pub-face", limit: 30, windowMs: 60_000 } });
