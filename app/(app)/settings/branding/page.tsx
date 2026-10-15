import { BrandingManager } from "@/components/branding/branding-manager";
import { requireAuth } from "@/lib/auth/session";
import { getBrand } from "@/lib/services/branding";

export const metadata = { title: "Branding" };

export default async function BrandingPage() {
  const auth = await requireAuth("branding:manage");
  return <BrandingManager endpoint="/api/organizations/branding" initial={await getBrand(auth.orgId)} />;
}
