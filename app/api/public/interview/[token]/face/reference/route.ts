import { ApiError, route } from "@/lib/api";
import { FaceReferenceMeta, readFaceUpload, saveFaceReference } from "@/lib/interview/face";

export const POST = route<{ token: string }>(async (req, { token }) => {
  const { meta, image } = await readFaceUpload(req, FaceReferenceMeta);
  if (!image) throw new ApiError(400, "A photo is required.");
  return saveFaceReference(token, { descriptor: meta.descriptor, image });
}, { rateLimit: { key: "pub-face-ref", limit: 20, windowMs: 60_000 } });
