import { route } from "@/lib/api";
import { FaceCheckMeta, readFaceUpload, recordFaceCheck } from "@/lib/interview/face";

export const POST = route<{ token: string }>(async (req, { token }) => {
  const { meta, image } = await readFaceUpload(req, FaceCheckMeta);
  return recordFaceCheck(token, { ...meta, image });
}, { rateLimit: { key: "pub-face-check", limit: 30, windowMs: 60_000 } });
