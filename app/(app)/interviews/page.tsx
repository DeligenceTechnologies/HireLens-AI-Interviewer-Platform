import Link from "next/link";
import { Suspense } from "react";
import { UserRound, Video } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SearchBar } from "@/components/common/search-bar";
import { EmptyState } from "@/components/common/states";
import { HumanInterviewTable } from "@/components/hiring/human-table";
import { InterviewTable } from "@/components/interviews/interview-table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { listHumanInterviews } from "@/lib/services/human-interviews";
import { listInterviews } from "@/lib/services/interviews";
import { listJobs } from "@/lib/services/jobs";
import { cn } from "@/lib/utils";

export const metadata = { title: "Interviews" };

export default async function InterviewsPage(props: PageProps<"/interviews">) {
  const auth = await requireAuth("interview:view");
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const human = str("type") === "human";
  const page = Number(str("page") ?? 1) || 1;
  const filters = { q: str("q"), status: str("status"), jobId: str("jobId"), from: str("from"), to: str("to") };
  const jobId = filters.jobId && /^[0-9a-f-]{36}$/i.test(filters.jobId) ? filters.jobId : undefined;
  const [ai, people, jobs] = await Promise.all([
    human ? null : listInterviews(auth.orgId, { ...filters, jobId, page }),
    human ? listHumanInterviews(auth.orgId, auth, { q: filters.q, status: filters.status, jobId, page }) : null,
    listJobs(auth.orgId),
  ]);
  const filtered = Object.values(filters).some(Boolean);
  const tab = (active: boolean) => cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm", active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground");
  const statusOptions = human
    ? [{ value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "no_show", label: "No-show" }, { value: "cancelled", label: "Cancelled" }]
    : [{ value: "pending", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "closed", label: "Cancelled / expired" }];
  return (
    <>
      <PageHeader title="Interviews" description="Every AI and human interview across your jobs." />
      <nav className="mb-4 flex gap-1 border-b" aria-label="Interview type">
        <Link href="/interviews" className={tab(!human)} aria-current={!human ? "page" : undefined}><Video className="size-4" /> AI interviews</Link>
        <Link href="/interviews?type=human" className={tab(human)} aria-current={human ? "page" : undefined}><UserRound className="size-4" /> Human interviews</Link>
      </nav>
      <div className="mb-4">
        <Suspense>
          <SearchBar key={human ? "human" : "ai"} placeholder="Search candidate, email or job…" filters={[
            { name: "status", label: "All statuses", options: statusOptions },
            { name: "jobId", label: "All jobs", options: jobs.map((j) => ({ value: j.id, label: j.title })) },
          ]} />
        </Suspense>
      </div>
      {human ? (
        people!.rows.length === 0 ? (
          <EmptyState icon={UserRound} title={filtered ? "No matching human interviews" : "No human interviews yet"} description={filtered ? "Try adjusting your filters." : "Add a human round to a job, then schedule it from a candidate's profile."} />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <HumanInterviewTable rows={people!.rows} showEmail={can(auth.role, "candidate:view")} />
            <Pagination page={page} pageSize={people!.pageSize} total={people!.total} basePath="/interviews" params={{ ...filters, type: "human" }} />
          </div>
        )
      ) : ai!.rows.length === 0 ? (
        <EmptyState icon={Video} title={filtered ? "No matching interviews" : "No interviews yet"} description={filtered ? "Try adjusting your filters." : "Invite a candidate from a job page to start."} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <InterviewTable rows={ai!.rows} />
          <Pagination page={page} pageSize={ai!.pageSize} total={ai!.total} basePath="/interviews" params={filters} />
        </div>
      )}
    </>
  );
}
