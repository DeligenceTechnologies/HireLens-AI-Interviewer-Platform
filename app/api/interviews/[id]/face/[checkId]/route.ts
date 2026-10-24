import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { faceImageResponse } from "@/lib/interview/face";

/** A face verification photo, for recruiters who can view recordings. */
export const GET = route<{ id: string; checkId: string }>(async (_req, { id, checkId }) => {
  const auth = await requireApiAuth("recording:view");
  return faceImageResponse(auth.orgId, uuidParam(id), uuidParam(checkId));
});
