import { notFound } from "next/navigation";
import { MembersCard, NotesCard, QuotaCard, SuspendButton, type CompanyData } from "@/components/admin/company-manager";
import { CompanyStatusBadge } from "@/components/admin/quota-badge";
import { PageHeader } from "@/components/common/page-header";
import { FormCard } from "@/components/settings/form-card";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getCompany } from "@/lib/services/admin";

export const metadata = { title: "Company" };

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default async function CompanyPage(props: PageProps<"/admin/companies/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const company = await getCompany(id);
  if (!company) notFound();
  const data = JSON.parse(JSON.stringify(company)) as CompanyData;
  const { usage } = company;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/companies", label: "Companies" }}
        title={<span className="flex flex-wrap items-center gap-3">{company.org.name} <CompanyStatusBadge status={company.org.status} /></span>}
        meta={<>
          <span>Created {formatDate(company.org.created_at)}</span>
          {company.org.suspended_at && <span>Suspended {formatDate(company.org.suspended_at, true)}</span>}
        </>}
        actions={<SuspendButton id={id} name={company.org.name} status={company.org.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <MembersCard id={id} members={data.members} invites={data.invites} />
          <FormCard title="Usage" description="Counts only. Candidate videos, transcripts and resumes stay private to the company.">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {[
                ["Jobs", usage.jobs], ["Candidates", usage.candidates], ["Interviews (all time)", usage.interviews_total], ["Completed (30d)", usage.completed_30d],
                ["Interview minutes (30d)", usage.minutes_30d], ["AI calls (30d)", usage.ai_calls_30d], ["AI tokens (30d)", Math.round(usage.ai_tokens_30d).toLocaleString()], ["Recording storage", formatBytes(usage.recording_bytes)],
              ].map(([k, v]) => <div key={String(k)}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-semibold tabular">{v}</dd></div>)}
            </dl>
          </FormCard>
        </div>
        <div className="min-w-0 space-y-6">
          <QuotaCard id={id} quota={data.quota} />
          <NotesCard id={id} notes={company.org.admin_notes} />
        </div>
      </div>
    </>
  );
}
