"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PlayCircle, Quote, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { formatClock } from "@/lib/format";
import type { StoredSummary, SummarySource } from "@/lib/services/candidate-summary";

export type SummaryState = { status: "processing" | "completed" | "failed"; summary: StoredSummary | null; source?: string | null };

function SourceLink({ s }: { s: SummarySource }) {
  const cls = "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
  return s.kind === "ai"
    ? <Link href={`/interviews/${s.interview_id}/recording?t=${s.ms}`} className={cls}><PlayCircle className="size-3 text-primary" />{s.round} <span className="font-mono">{formatClock(s.ms)}</span></Link>
    : <Link href={`/interviews/human/${s.human_interview_id}`} className={cls}><UserRound className="size-3" />{s.interviewer} · {s.round}</Link>;
}

function Sources({ list }: { list: SummarySource[] }) {
  if (!list.length) return null;
  return <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">{list.map((s, i) => <SourceLink key={i} s={s} />)}</span>;
}

/** One card to support the shortlist decision, once every round is Qualified. */
export function OverallSummaryCard({ state, jobId, candidateId, canRetry }: { state: SummaryState; jobId: string; candidateId: string; canRetry: boolean }) {
  const [retrying, setRetrying] = useState(false);
  const s = state.summary;

  if (state.status !== "completed" || !s) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm text-muted-foreground">
        {state.status === "failed" && !retrying
          ? <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> We couldn&apos;t prepare the overall result.</span>
          : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Preparing the overall result from every round…</span>}
        {state.status === "failed" && canRetry && !retrying && (
          <Button size="sm" variant="outline" onClick={async () => {
            setRetrying(true);
            await api(`/api/candidates/${candidateId}/summary`, { body: { job_id: jobId } }).catch(() => setRetrying(false));
          }}><RefreshCw /> Try again</Button>
        )}
      </div>
    );
  }

  const h = s.headline;
  const facts = [
    `${h.rounds} of ${h.rounds} rounds Qualified`,
    h.average_rating != null && `Interviewer average ${h.average_rating}/5`,
    h.scorecards > 0 && `${h.recommends} of ${h.scorecards} interviewer${h.scorecards === 1 ? " recommends" : "s recommend"}`,
    h.requirements_met != null && h.requirements_total > 0 && `${h.requirements_met} of ${h.requirements_total} required skills evidenced`,
  ].filter(Boolean) as string[];

  return (
    <section className="border-t bg-primary/[0.03] px-5 py-4" aria-label="Overall result">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Overall result</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {facts.map((f) => <li key={f} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium"><CheckCircle2 className="size-3.5 text-emerald-600" />{f}</li>)}
      </ul>
      <p className="mt-3 text-sm leading-relaxed">{s.summary}</p>
      {s.highlights.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {s.highlights.map((x, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /><span>{x.point}<Sources list={x.sources} /></span></li>)}
        </ul>
      )}
      {s.concern && (
        <p className="mt-2 flex gap-2 text-sm"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" /><span><span className="font-medium">To consider:</span> {s.concern.point}<Sources list={s.concern.sources} /></span></p>
      )}
      {s.quote && (
        <blockquote className="mt-3 flex gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>“{s.quote.text}” <Link href={`/interviews/human/${s.quote.human_interview_id}`} className="whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">— {s.quote.interviewer}, {s.quote.round}</Link></span>
        </blockquote>
      )}
      {s.missing_requirements.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Not evidenced in any round: {s.missing_requirements.join(", ")}</p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        {state.source === "mock" ? "Demo mode: written without AI. " : "AI summary of your team's decisions, scorecards and the interview evidence. "}
        It doesn&apos;t recommend hiring; your team decides.
      </p>
    </section>
  );
}
