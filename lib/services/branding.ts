import "server-only";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { type Brand, isHexColor, LOGO_MAX_BYTES, logoUrl } from "@/lib/branding";
import { withSystem, type Tx } from "@/lib/database/db";
import { log } from "@/lib/logger";
import { paths, storage } from "@/lib/storage";
import { platformAudit } from "./platform";

// Company logo and brand colour, shown to candidates instead of platform branding.
// Logos are raster images only (no SVG: it can carry scripts), checked by content.

const KINDS = [
  { ext: "png", mime: "image/png", is: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
  { ext: "jpg", mime: "image/jpeg", is: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "webp", mime: "image/webp", is: (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP" },
] as const;
const MIME: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.ext, k.mime]));

export function detectLogo(bytes: Uint8Array) {
  if (!bytes.byteLength) throw new ApiError(400, "The file is empty.");
  if (bytes.byteLength > LOGO_MAX_BYTES) throw new ApiError(413, "Logos must be 2 MB or smaller.");
  const kind = KINDS.find((k) => k.is(bytes));
  if (!kind) throw new ApiError(415, "Please upload a PNG, JPG or WebP image.");
  return kind;
}

/** Who made the change: a company member, or a platform admin acting for the company. */
export type BrandingActor = { userId: string; platformAdmin?: boolean };

async function record(tx: Tx, orgId: string, actor: BrandingActor, change: string) {
  if (actor.platformAdmin) await platformAudit(tx, { adminId: actor.userId, action: "company.branding_updated", targetType: "organization", targetId: orgId, details: { change } });
  else await audit(tx, { orgId, userId: actor.userId, action: "settings.branding_updated", entityType: "organization", entityId: orgId, metadata: { change } });
}

const brandRow = (tx: Tx, orgId: string) => tx<{ name: string; logo_path: string | null; logo_updated_at: Date | null; brand_color: string | null }[]>`
  select name, logo_path, logo_updated_at, brand_color from organizations where id = ${orgId}`;

export async function getBrand(orgId: string): Promise<Brand> {
  const [o] = await withSystem((tx) => brandRow(tx, orgId));
  if (!o) throw new ApiError(404, "Company not found");
  return { name: o.name, logoUrl: logoUrl(orgId, o.logo_updated_at, o.logo_path), color: o.brand_color };
}

export async function setLogo(orgId: string, actor: BrandingActor, bytes: Uint8Array) {
  const kind = detectLogo(bytes);
  const version = Date.now();
  const path = paths.logo(orgId, version, kind.ext);
  await storage().put(path, bytes, kind.mime);
  const old = await withSystem(async (tx) => {
    const [o] = await tx<{ logo_path: string | null }[]>`select logo_path from organizations where id = ${orgId} for update`;
    if (!o) throw new ApiError(404, "Company not found");
    await tx`update organizations set logo_path = ${path}, logo_updated_at = ${new Date(version)} where id = ${orgId}`;
    await record(tx, orgId, actor, "logo_uploaded");
    return o.logo_path;
  });
  if (old) await storage().delete(old).catch((err) => log.warn("branding.old_logo_delete_failed", { err }));
  return getBrand(orgId);
}

export async function removeLogo(orgId: string, actor: BrandingActor) {
  const old = await withSystem(async (tx) => {
    const [o] = await tx<{ logo_path: string | null }[]>`select logo_path from organizations where id = ${orgId} for update`;
    if (!o) throw new ApiError(404, "Company not found");
    await tx`update organizations set logo_path = null, logo_updated_at = null where id = ${orgId}`;
    await record(tx, orgId, actor, "logo_removed");
    return o.logo_path;
  });
  if (old) await storage().delete(old).catch((err) => log.warn("branding.logo_delete_failed", { err }));
  return getBrand(orgId);
}

export async function setBrandColor(orgId: string, actor: BrandingActor, color: string | null) {
  const value = color?.toLowerCase() ?? null;
  if (value !== null && !isHexColor(value)) throw new ApiError(400, "Choose a colour like #0b5bd3.");
  await withSystem(async (tx) => {
    const [o] = await tx`update organizations set brand_color = ${value} where id = ${orgId} returning id`;
    if (!o) throw new ApiError(404, "Company not found");
    await record(tx, orgId, actor, value ? "color_set" : "color_cleared");
  });
  return getBrand(orgId);
}

/** The stored logo for the public logo route, or null. */
export async function readLogo(orgId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const [o] = await withSystem((tx) => tx<{ logo_path: string | null }[]>`select logo_path from organizations where id = ${orgId}`);
  if (!o?.logo_path) return null;
  const bytes = await storage().get(o.logo_path).catch(() => null);
  if (!bytes) return null;
  return { bytes, mime: MIME[o.logo_path.split(".").pop() ?? ""] ?? "application/octet-stream" };
}
