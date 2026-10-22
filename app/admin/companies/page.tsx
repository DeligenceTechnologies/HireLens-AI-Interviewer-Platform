import Link from "next/link";
import { Building2 } from "lucide-react";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { NewCompanyButton, RevokeLinkButton } from "@/components/admin/new-company";
import { CompanyStatusBadge, QuotaBadge, TrialBadge } from "@/components/admin/quota-badge";
import { PageHeader } from "@/components/common/page-header";
import { SearchBar } from "@/components/common/search-bar";
import { EmptyState } from "@/components/common/states";
import { formatDate, timeAgo } from "@/lib/format";
import { listCompanies, listCompanyInvites, type CompanyFilter } from "@/lib/services/admin";
import { getDefaultQuota } from "@/lib/services/platform";

export const metadata = { title: "Companies" };

const TABS: { value: CompanyFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "trial", label: "Free trials" }, { value: "suspended", label: "Suspended" }, { value: "out_of_quota", label: "Out of interviews" },
];

export default async function CompaniesPage(props: PageProps<"/admin/companies">) {
  const sp = await props.searchParams;
  const filter = TABS.find((t) => t.value === sp.filter)?.value ?? "all";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [companies, links, defaultQuota] = await Promise.all([listCompanies({ q, filter }), listCompanyInvites(), getDefaultQuota()]);
  return (
    <>
      <PageHeader title="Companies" description="Every company workspace, its team and its free interviews." actions={<NewCompanyButton defaultQuota={defaultQuota} />} />

      {links.length > 0 && (
        <section className="mb-6 rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Pending sign-up links</h2>
            <p className="text-xs text-muted-foreground">Approved companies that haven&apos;t signed up yet.</p>
          </div>
          <ul className="divide-y">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1"><p className="font-medium">{l.company_name}</p><p className="text-xs text-muted-foreground">{l.email} · {l.interview_quota ?? "Unlimited"} free interviews · expires {formatDate(l.expires_at)}</p></div>
                <RevokeLinkButton id={l.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <FilterTabs base="/admin/companies" param="filter" current={filter} tabs={TABS} />
      <div className="mb-4"><SearchBar placeholder="Search company or member email…" /></div>
      {companies.length === 0 ? <EmptyState icon={Building2} title="No companies found" /> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Company</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Free interviews</th><th className="px-4 py-2.5 font-medium">Members</th><th className="px-4 py-2.5 font-medium">Last interview</th><th className="px-4 py-2.5 text-right font-medium">Created</th></tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((c) => (
                <tr key={c.id} className="group relative hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{c.name}</Link>
                    <p className="text-xs text-muted-foreground">{c.owner_email ?? "No owner"}</p>
                    {c.same_domain > 0 && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Same email domain as {c.same_domain} other trial{c.same_domain === 1 ? "" : "s"}</p>}
                  </td>
                  <td className="px-4 py-3"><span className="flex flex-wrap gap-1"><CompanyStatusBadge status={c.status} />{c.plan === "trial" && <TrialBadge daysLeft={c.trial_days_left} />}</span></td>
                  <td className="px-4 py-3"><QuotaBadge quota={c.interview_quota} used={c.used} inProgress={c.in_progress} /></td>
                  <td className="px-4 py-3 tabular">{c.members}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.last_interview_at ? timeAgo(c.last_interview_at) : "—"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
