import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, body } from "@/lib/api";
import { LOGO_MAX_BYTES } from "@/lib/branding";
import { type BrandingActor, removeLogo, setBrandColor, setLogo } from "@/lib/services/branding";

// Shared handlers for the company settings and platform admin branding routes.

export async function uploadLogo(req: NextRequest, orgId: string, actor: BrandingActor) {
  if (Number(req.headers.get("content-length") ?? 0) > LOGO_MAX_BYTES + 64 * 1024) throw new ApiError(413, "Logos must be 2 MB or smaller.");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose an image to upload.");
  return setLogo(orgId, actor, new Uint8Array(await file.arrayBuffer()));
}

export async function updateColor(req: NextRequest, orgId: string, actor: BrandingActor) {
  const { color } = await body(req, z.object({ color: z.string().trim().toLowerCase().regex(/^#[0-9a-f]{6}$/, "Choose a colour like #0b5bd3.").nullable() }));
  return setBrandColor(orgId, actor, color);
}

export const deleteLogo = (orgId: string, actor: BrandingActor) => removeLogo(orgId, actor);
