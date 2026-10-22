import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Users } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { DecisionBadge } from "@/components/hiring/badges";
import { DecisionControl } from "@/components/hiring/decision-control";
import { HumanActions } from "@/components/hiring/human-actions";
import { ScorecardForm, Stars } from "@/components/hiring/scorecard-form";
import { FormCard } from "@/components/settings/form-card";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { DECISION_LABEL, formatInZone, LOCATION_LABEL } from "@/lib/hiring";
import { isUuid } from "@/lib/ids";
import { formatDate } from "@/lib/format";
import { getHumanInterview, inviteMessage, listPanelCandidates } from "@/lib/services/human-interviews";

export const metadata = { title: "Human interview" };

const HISTORY_LABEL: Record<string, string> = { scheduled: "Scheduled", rescheduled: "Rescheduled", cancelled: "Cancelled", completed: "Marked completed", no_show: "Marked no-show", reopened: "Moved back to scheduled" };

export default async function HumanInterviewPage(props: PageProps<"/interviews/human/[id]">) {
  const auth = await requireAuth("interview:view");
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const h = await getHumanInterview(auth.orgId, id, auth);
  if (!h) notFound();
  const canManage = can(auth.role, "interview:write");
  const canDecide = can(auth.role, "decision:write");
  const onPanel = h.panel.some((p) => p.user_id === auth.userId);
  const mine = h.scorecards.find((s) => s.user_id === auth.userId) ?? null;
  // Interviewers see their own scorecard; people who decide see everyone's submitted ones.
  const others = h.scorecards.filter((s) => s.submitted_at && s.user_id !== auth.userId && (canDecide || auth.role !== "interviewer"));
  const submitted = h.scorecards.filter((s) => s.submitted_at);
  const recs = submitted.map((s) => s.recommendation).filter(Boolean);
  const hint = recs.length ? `${recs.length} of ${h.panel.length} interviewer${h.panel.length === 1 ? "" : "s"} recommend: ${Object.entries(recs.reduce<Record<string, number>>((a, r) => ({ ...a, [r!]: (a[r!] ?? 0) + 1 }), {})).map(([d, n]) => `${DECISION_LABEL[d as keyof typeof DECISION_LABEL]} (${n})`).join(", ")}` : h.status === "completed" ? "No scorecards submitted yet." : null;
  const members = canManage ? await listPanelCandidates(auth.orgId) : [];
  const isLink = h.location_type === "video" && h.location && /^https?:\/\//i.test(h.location);
  const names = new Map([...h.panel, ...members].map((m) => [m.user_id, m.name]));
  return (
    <>
      <PageHeader
        back={can(auth.role, "candidate:view") ? { href: `/candidates/${h.candidate_id}`, label: h.candidate_name } : { href: "/dashboard", label: "Dashboard" }}
        title={<span className="flex flex-wrap items-center gap-3">{h.round_name}: {h.candidate_name} <StatusBadge status={h.status} /></span>}
        meta={<>
          <span>Human interview</span>
          {can(auth.role, "job:write") || canManage ? <Link href={`/jobs/${h.job_id}`} className="hover:text-foreground">{h.job_title}</Link> : <span>{h.job_title}</span>}
          {h.attempt > 1 && <span>Attempt {h.attempt}</span>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <FormCard title="Interview details" description={h.status === "cancelled" ? `Cancelled${h.cancel_reason ? `: ${h.cancel_reason}` : ""}` : undefined}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="sr-only">When</dt><dd className="font-medium">{formatInZone(h.scheduled_at, h.timezone, { withYear: true })}</dd><dd className="text-xs text-muted-foreground">{h.duration_minutes} minutes · {h.timezone.replace(/_/g, " ")}</dd></div></div>
              <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><dt className="sr-only">Where</dt><dd className="font-medium">{LOCATION_LABEL[h.location_type]}</dd>
                {h.location && <dd className="truncate text-xs">{isLink ? <a href={h.location} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{h.location}</a> : h.location}</dd>}</div></div>
              <div className="flex gap-2 sm:col-span-2"><Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="sr-only">Interviewers</dt><dd>{h.panel.map((p) => p.name).join(", ")}</dd></div></div>
              {h.message && <div className="rounded-lg bg-muted/50 px-3 py-2 sm:col-span-2"><dt className="text-xs text-muted-foreground">Message to the candidate</dt><dd className="mt-0.5 whitespace-pre-wrap">{h.message}</dd></div>}
            </dl>
            <HumanActions id={h.id} status={h.status} candidateName={h.candidate_name} roundName={h.round_name} inviteText={inviteMessage(h)} canManage={canManage}
              emailLive={env().EMAIL_PROVIDER !== "log"} members={members.map((m) => ({ user_id: m.user_id, name: m.name, role: m.role }))}
              schedule={{ scheduledAt: h.scheduled_at.toISOString(), durationMinutes: h.duration_minutes, timezone: h.timezone, locationType: h.location_type, location: h.location, message: h.message, interviewerIds: h.panel.map((p) => p.user_id) }} />
          </FormCard>

          {onPanel && can(auth.role, "scorecard:write") && h.status !== "cancelled" && (
            <FormCard title="Your scorecard" description={mine?.submitted_at ? "Submitted. You can still update it." : "Rate each skill from 1 to 5. Your team sees it once you submit."}>
              <ScorecardForm id={h.id} criteria={h.criteria} submitted={!!mine?.submitted_at}
                initial={mine ? { ratings: mine.ratings, notes: mine.notes, recommendation: mine.recommendation } : null} />
            </FormCard>
          )}

          {others.length > 0 && (
            <FormCard title="Scorecards from the panel">
              <ul className="space-y-5">
                {others.map((s) => (
                  <li key={s.user_id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{s.name}</p>{s.recommendation && <DecisionBadge decision={s.recommendation} />}</div>
                    <ul className="space-y-1.5">
                      {s.ratings.map((r) => (
                        <li key={r.criterion} className="text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span>{r.criterion}</span><Stars value={r.rating} label={`${s.name}'s rating for ${r.criterion}`} /></div>
                          {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                    {s.notes && <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">{s.notes}</p>}
                  </li>
                ))}
              </ul>
            </FormCard>
          )}
          {!onPanel && others.length === 0 && h.status !== "cancelled" && (
            <p className="rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">Scorecards appear here once the interviewers submit them.</p>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <FormCard title="Decision" description="Your team's call for this round. Scorecards are recommendations.">
            <DecisionControl endpoint={`/api/human-interviews/${h.id}/decision`} decision={h.decision} note={h.decision_note} decidedBy={h.decided_by_name}
              decidedOn={h.decided_at ? formatDate(h.decided_at) : null} canEdit={canDecide && h.status !== "cancelled"} hint={hint} />
          </FormCard>
          <FormCard title="Interview guide">
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Assess</p>
                <ul className="flex flex-wrap gap-1.5">{h.criteria.map((c) => <li key={c} className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{c}</li>)}</ul>
              </div>
              {h.guide ? <p className="whitespace-pre-wrap text-muted-foreground">{h.guide}</p> : <p className="text-muted-foreground">No guide for this round. Add one by editing the job&apos;s rounds.</p>}
            </div>
          </FormCard>
          <FormCard title="History">
            <ol className="space-y-2 text-sm">
              {[...h.history].reverse().map((e, i) => (
                <li key={i}>
                  <p>{HISTORY_LABEL[e.type] ?? e.type}{e.to && e.type !== "cancelled" ? `: ${formatInZone(e.to, h.timezone)}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{names.get(e.by) ?? "Someone"} · {new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{e.reason ? ` · ${e.reason}` : ""}</p>
                </li>
              ))}
            </ol>
          </FormCard>
        </div>
      </div>
    </>
  );
}
