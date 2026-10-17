import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Logo } from "@/components/layout/logo";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { withSystem } from "@/lib/database/db";

export const metadata = { title: { default: "Platform admin", template: "%s · Admin · PickMyHire.ai" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requirePlatformAdmin();
  const [{ n }] = await withSystem((tx) => tx<{ n: number }[]>`select count(*)::int as n from access_requests where status = 'new'`);
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b bg-sidebar px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:py-4">
        <div className="mb-3 flex items-center justify-between gap-2 px-2 lg:mb-6 lg:block">
          <Link href="/admin"><Logo height={28} /></Link>
          <div className="flex items-center gap-2 lg:mt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><ShieldCheck className="size-3.5" /> Platform admin</p>
            <div className="lg:hidden"><SignOutButton /></div>
          </div>
        </div>
        <AdminNav newRequests={n} />
        <div className="mt-auto hidden space-y-2 border-t pt-3 lg:block">
          {admin.hasCompany && (
            <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="size-4" /> Back to workspace
            </Link>
          )}
          <div className="px-3 text-xs">
            <p className="truncate font-medium">{admin.name}</p>
            <p className="truncate text-muted-foreground">{admin.email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
