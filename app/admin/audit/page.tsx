import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { formatDate } from "@/lib/format";
import { listPlatformAudit, PLATFORM_AUDIT_PAGE_SIZE } from "@/lib/services/admin";
import Link from "next/link";

export const metadata = { title: "Audit log" };

const LABEL: Record<string, string> = {
  "access_request.updated": "Updated access request",
  "access_request.approved": "Approved access request",
  "company_invite.created": "Created company sign-up link",
  "company_invite.revoked": "Revoked company sign-up link",
  "company.updated": "Updated company",
  "company.suspended": "Suspended company",
  "company.trial_started": "Free trial started",
  "company.trial_extended": "Extended free trial",
  "company.trial_converted": "Converted trial to full account",
  "company.reactivated": "Reactivated company",
  "company.member_added": "Added member",
  "company.member_invited": "Invited member",
  "company.member_role_changed": "Changed member role",
  "company.member_removed": "Removed member",
  "company.member_invite_revoked": "Revoked member invitation",
  "company.branding_updated": "Updated company branding",
  "company.ownership_transferred": "Transferred ownership",
  "user.disabled": "Disabled user",
  "user.enabled": "Enabled user",
  "user.reset_link_created": "Created password reset link",
  "settings.updated": "Updated platform settings",
};

function describe(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AdminAuditPage(props: PageProps<"/admin/audit">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await listPlatformAudit(page);
  return (
    <>
      <PageHeader title="Audit log" description="Every action taken by platform admins." />
      {rows.length === 0 ? <EmptyState icon={ScrollText} title="No admin actions yet" /> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Admin</th><th className="px-4 py-2.5 font-medium">Action</th><th className="px-4 py-2.5 font-medium">Details</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(r.created_at, true)}</td>
                  <td className="px-4 py-3">{r.admin_name ?? (r.action === "company.trial_started" ? "Self sign-up" : "—")}<p className="text-xs text-muted-foreground">{r.admin_email ?? (r.action === "company.trial_started" ? String(r.details.email ?? "") : "")}</p></td>
                  <td className="px-4 py-3">
                    {r.target_type === "organization" && r.target_id ? <Link href={`/admin/companies/${r.target_id}`} className="hover:text-primary">{LABEL[r.action] ?? r.action}</Link> : (LABEL[r.action] ?? r.action)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{describe(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={`/admin/audit?page=${page - 1}`} className="text-primary hover:underline">Newer</Link> : <span />}
        {rows.length === PLATFORM_AUDIT_PAGE_SIZE && <Link href={`/admin/audit?page=${page + 1}`} className="text-primary hover:underline">Older</Link>}
      </div>
    </>
  );
}
