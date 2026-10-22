import Link from "next/link";
import { AlertTriangle, Building2, Clock, Inbox, Sparkles, Users, Video } from "lucide-react";
import { QuotaBadge, TrialBadge } from "@/components/admin/quota-badge";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ISSUE_CATEGORIES } from "@/lib/feedback";
import { formatDate, timeAgo } from "@/lib/format";
import { getOverview } from "@/lib/services/admin";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const { totals, month, outOfQuota, recentCompanies, recentIssues, trials } = await getOverview();
  return (
    <>
      <PageHeader title="Platform overview" description="All companies on PickMyHire.ai." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies" value={totals.companies} hint={`${totals.active} active · ${totals.suspended} suspended`} icon={Building2} />
        <StatCard label="Users" value={totals.users} icon={Users} />
        <StatCard label="Interviews completed" value={month.completed} hint={`This month · ${month.minutes} min`} icon={Video} />
        <StatCard label="Access requests" value={totals.new_requests} hint={`New · ${totals.pending_links} sign-up links pending`} icon={Inbox} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-sky-600" /> Free trials</h2>
            <Link href="/admin/companies?filter=trial" className="text-sm text-primary hover:underline">All trials</Link>
          </div>
          {trials.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No free trials yet.</p> : (
            <ul className="divide-y">
              {trials.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/companies/${c.id}`} className="block truncate font-medium hover:text-primary">{c.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{c.owner_email ?? "No owner"} · started {timeAgo(c.created_at)}</p>
                    {c.same_domain > 0 && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Same email domain as {c.same_domain} other trial{c.same_domain === 1 ? "" : "s"}: check it&apos;s genuine</p>}
                  </div>
                  <TrialBadge daysLeft={c.trial_days_left} />
                  <QuotaBadge quota={c.interview_quota} used={c.used} inProgress={c.in_progress} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-600" /> Out of free interviews</h2>
            <Link href="/admin/companies?filter=out_of_quota" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {outOfQuota.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Every company has interviews left.</p> : (
            <ul className="divide-y">
              {outOfQuota.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/admin/companies/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{c.name}</Link>
                  <QuotaBadge quota={c.interview_quota} used={c.used} inProgress={c.in_progress} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="font-semibold">Newest companies</h2>
            <Link href="/admin/companies" className="text-sm text-primary hover:underline">All companies</Link>
          </div>
          <ul className="divide-y">
            {recentCompanies.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/companies/${c.id}`} className="block truncate font-medium hover:text-primary">{c.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{c.owner_email ?? "No owner"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Recent candidate issue reports</h2>
            <p className="text-xs text-muted-foreground">Category only. Details stay with each company.</p>
          </div>
          {recentIssues.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No issues reported.</p> : (
            <ul className="divide-y">
              {recentIssues.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span className="font-medium">{ISSUE_CATEGORIES[r.category as keyof typeof ISSUE_CATEGORIES] ?? r.category}</span>
                  <Link href={`/admin/companies/${r.org_id}`} className="text-muted-foreground hover:text-primary">{r.org_name}</Link>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{timeAgo(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
