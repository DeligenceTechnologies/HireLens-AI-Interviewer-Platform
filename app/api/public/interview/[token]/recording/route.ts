import { z } from "zod";
import { body, route } from "@/lib/api";
import { startRecordingPart } from "@/lib/interview/recording";

export const POST = route<{ token: string }>(async (req, { token }) => {
  return startRecordingPart(token, await body(req, z.object({ offset_ms: z.number().min(0), mime_type: z.string().max(100), track: z.enum(["candidate", "interviewer"]).optional() })));
}, { rateLimit: { key: "pub-rec-start", limit: 20, windowMs: 60_000 } });
