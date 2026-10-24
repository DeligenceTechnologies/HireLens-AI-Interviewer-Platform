import Link from "next/link";
import { Bot, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/format";
import { formatInZone } from "@/lib/hiring";
import type { CandidatePipeline, RoundEntry } from "@/lib/services/pipeline";
import { DecisionBadge, StageBadge } from "./badges";
import { ScheduleButton, type PanelMember } from "./schedule-dialog";
import { StageControl } from "./stage-control";
import { OverallSummaryCard, type SummaryState } from "./overall-summary-card";

const href = (e: RoundEntry) => (e.kind === "human" ? `/interviews/human/${e.id}` : `/interviews/${e.id}`);
const when = (e: RoundEntry) => (e.kind === "human" && e.at && e.timezone ? formatInZone(e.at, e.timezone) : formatDate(e.at ?? e.created_at));

function EntryLine({ e }: { e: RoundEntry }) {
  return (
    <Link href={href(e)} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground hover:text-foreground">
      <StatusBadge status={e.status} />
      <span>{when(e)}{e.attempt > 1 ? ` · attempt ${e.attempt}` : ""}</span>
      {e.decision && <DecisionBadge decision={e.decision} />}
      {!e.decision && (e.status === "completed" || e.status === "report_ready" || e.status === "processing") && <span className="font-medium text-violet-700 dark:text-violet-300">Awaiting decision</span>}
    </Link>
  );
}

/** A candidate's progress in each job: round by round, then the overall outcome. */
export function CandidatePipelines({ pipelines, candidateId, candidateName, canDecide, canSchedule, members, emailLive, summaries = {} }: {
  pipelines: CandidatePipeline[]; candidateId: string; candidateName: string; canDecide: boolean; canSchedule: boolean; members: PanelMember[]; emailLive: boolean;
  /** Overall result per job, for candidates who cleared every round. */
  summaries?: Record<string, SummaryState>;
}) {
  if (!pipelines.length) return null;
  return (
    <div className="space-y-4">
      {pipelines.map((p) => (
        <section key={p.job_id} className="rounded-xl border bg-card" aria-label={`Hiring progress for ${p.job_title}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Link href={`/jobs/${p.job_id}`} className="font-semibold hover:text-primary">{p.job_title}</Link>
              {p.stage_changed_at && <p className="text-xs text-muted-foreground">{[p.stage_by && `by ${p.stage_by}`, formatDate(p.stage_changed_at)].filter(Boolean).join(" · ")}{p.stage_note ? ` · “${p.stage_note}”` : ""}</p>}
            </div>
            <StageBadge stage={p.stage} className="text-sm" />
          </div>
          <ol className="divide-y">
            {p.results.map((r, i) => {
              const attempts = p.entries.filter((e) => e.round_id === r.round.id);
              const scheduled = attempts.some((e) => e.kind === "human" && e.status === "scheduled");
              return (
                <li key={r.round.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {r.round.name}
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                        {r.round.kind === "human" ? <><UserRound className="size-3" /> Human</> : <><Bot className="size-3" /> AI</>}
                      </span>
                    </p>
                    {attempts.length ? attempts.slice(-2).reverse().map((e) => <EntryLine key={e.id} e={e} />)
                      : <p className="text-xs text-muted-foreground">Not started{r.round.kind === "ai" ? " · use “Invite to interview” above" : ""}</p>}
                  </div>
                  {r.round.kind === "human" && canSchedule && !scheduled && r.decision !== "qualified" && (
                    <ScheduleButton label={attempts.length ? "Schedule again" : "Schedule"} members={members} emailLive={emailLive}
                      mode={{ kind: "create", jobId: p.job_id, candidateId, candidateName, roundId: r.round.id, roundName: r.round.name }} />
                  )}
                </li>
              );
            })}
            {p.results.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">This job has no interview rounds.</li>}
          </ol>
          {p.extras.length > 0 && (
            <div className="border-t px-5 py-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Other interviews</p>
              <ul className="space-y-1.5">{p.extras.map((e) => <li key={e.id}><p className="text-sm">{e.round_name}</p><EntryLine e={e} /></li>)}</ul>
            </div>
          )}
          {canSchedule && p.job_status !== "closed" && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2.5">
              <p className="text-xs text-muted-foreground">Need another conversation with {candidateName.split(" ")[0]}? Add a one-off human interview without changing the job&apos;s rounds.</p>
              <ScheduleButton label="Schedule extra interview" members={members} emailLive={emailLive}
                mode={{ kind: "create", jobId: p.job_id, candidateId, candidateName, roundName: "Extra interview" }} />
            </div>
          )}
          {p.allQualified && summaries[p.job_id] && (
            <OverallSummaryCard state={summaries[p.job_id]} jobId={p.job_id} candidateId={candidateId} canRetry={canDecide} />
          )}
          {canDecide && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {p.stage === "in_progress" ? (p.allQualified ? "Every round is marked Qualified. Ready to shortlist." : `${p.results.filter((r) => r.decision === "qualified").length} of ${p.results.length} rounds qualified.`) : "Final outcome for this job."}
              </p>
              <StageControl jobId={p.job_id} candidateId={candidateId} candidateName={candidateName} stage={p.stage} allQualified={p.allQualified} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
