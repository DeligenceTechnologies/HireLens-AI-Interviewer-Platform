import "server-only";
// Overall summary for a candidate who has cleared every round of a job: the
// round results, interviewers' scores and recommendations (no AI), plus a short
// AI summary that links back to evidence. It supports the shortlist decision;
// it never recommends hiring or scores the candidate. Built only once every
// round is marked Qualified, and rebuilt when any of those decisions changes.

import { json, withOrg } from "@/lib/database/db";
import { ApiError } from "@/lib/api";
import { log } from "@/lib/logger";
import { runInBackground } from "@/lib/background";
import { untrusted } from "@/prompts/shared";
import { generateOverallSummary, OVERALL_SUMMARY_VERSION } from "@/lib/ai/overall-summary";
import type { StoredReport } from "@/lib/interview/processing";
import { formatClock } from "@/lib/format";
import { DECISION_LABEL, type Decision } from "@/lib/hiring";
import type { OverallSummary } from "@/lib/validation/ai-schemas";
import { getCandidatePipelines, summaryFingerprint, type CandidatePipeline } from "./pipeline";

export type SummarySource =
  | { kind: "ai"; round: string; interview_id: string; ms: number }
  | { kind: "human"; round: string; human_interview_id: string; interviewer: string };

export type StoredSummary = {
  version: 1;
  prompt_version: string;
  headline: {
    rounds: number;
    ai_rounds: number;
    human_rounds: number;
    /** Average of every interviewer rating (1–5), or null without ratings. */
    average_rating: number | null;
    recommends: number;
    scorecards: number;
    requirements_met: number | null;
    requirements_total: number;
  };
  summary: string;
  highlights: { point: string; sources: SummarySource[] }[];
  concern: { point: string; sources: SummarySource[] } | null;
  quote: { text: string; interviewer: string; round: string; human_interview_id: string } | null;
  missing_requirements: string[];
};

export type SummaryRow = { job_id: string; fingerprint: string; status: "processing" | "completed" | "failed"; summary: StoredSummary | null; source: string | null; updated_at: Date };

/** A processing row older than this is treated as abandoned and rebuilt. */
const STALE_PROCESSING_MS = 5 * 60_000;

type Scorecard = { user_id: string; name: string; ratings: { criterion: string; rating: number | null; comment?: string | null }[]; notes: string | null; recommendation: Decision | null };

export async function getCandidateSummaries(orgId: string, candidateId: string) {
  const rows = await withOrg(orgId, (tx) => tx<SummaryRow[]>`
    select job_id, fingerprint, status, summary, source, updated_at from candidate_summaries where candidate_id = ${candidateId} and organization_id = ${orgId}`);
  return new Map(rows.map((r) => [r.job_id, r]));
}

/**
 * The summary to show for each job where the candidate has cleared every round,
 * starting (in the background) any that are missing or out of date.
 */
export async function summariesForPipelines(orgId: string, candidateId: string, pipelines: CandidatePipeline[]) {
  const rows = await getCandidateSummaries(orgId, candidateId);
  const out = new Map<string, SummaryRow | { status: "processing"; summary: null }>();
  for (const p of pipelines) {
    if (!p.allQualified) continue;
    const row = rows.get(p.job_id);
    const fp = summaryFingerprint(p.results);
    if (row && row.fingerprint === fp && !(row.status === "processing" && Date.now() - row.updated_at.getTime() > STALE_PROCESSING_MS)) {
      out.set(p.job_id, row);
      continue;
    }
    runInBackground("candidate.summary", () => buildCandidateSummary(orgId, p.job_id, candidateId));
    out.set(p.job_id, { status: "processing", summary: null });
  }
  return out;
}

/** After a round decision: build the summary if the candidate has now cleared every round. */
export function summarizeIfCleared(orgId: string, jobId: string, candidateId: string) {
  runInBackground("candidate.summary", async () => {
    const [p] = (await getCandidatePipelines(orgId, candidateId)).filter((x) => x.job_id === jobId);
    if (p?.allQualified) await buildCandidateSummary(orgId, jobId, candidateId);
  });
}

/** Build (or rebuild) the summary. `force` retries a failed one with the same decisions. */
export async function buildCandidateSummary(orgId: string, jobId: string, candidateId: string, force = false) {
  const [p] = (await getCandidatePipelines(orgId, candidateId)).filter((x) => x.job_id === jobId);
  if (!p) throw new ApiError(404, "Candidate not found for this job");
  if (!p.allQualified) throw new ApiError(409, "The summary is available once every round is marked Qualified.");
  const fp = summaryFingerprint(p.results);

  // Claim the work: skip if this exact summary is done or already being built.
  const claimed = await withOrg(orgId, async (tx) => {
    const [row] = await tx<{ fingerprint: string; status: string; updated_at: Date }[]>`
      select fingerprint, status, updated_at from candidate_summaries where job_id = ${jobId} and candidate_id = ${candidateId} for update`;
    if (row && row.fingerprint === fp) {
      if (row.status === "completed") return false;
      if (row.status === "processing" && Date.now() - row.updated_at.getTime() < STALE_PROCESSING_MS) return false;
      if (row.status === "failed" && !force) return false;
    }
    await tx`insert into candidate_summaries (organization_id, job_id, candidate_id, fingerprint, status)
      values (${orgId}, ${jobId}, ${candidateId}, ${fp}, 'processing')
      on conflict (job_id, candidate_id) do update set fingerprint = excluded.fingerprint, status = 'processing', summary = null, error = null`;
    return true;
  });
  if (!claimed) return;

  try {
    const material = await gather(orgId, jobId, p);
    const { summary, source } = await generateOverallSummary({
      orgId, jobTitle: p.job_title, requirements: material.requirements, rounds: material.text, roundNames: p.results.map((r) => r.round.name),
    });
    const stored = finalize(summary, material);
    await withOrg(orgId, (tx) => tx`
      update candidate_summaries set status = 'completed', summary = ${json(stored)}, source = ${source}
      where job_id = ${jobId} and candidate_id = ${candidateId} and fingerprint = ${fp}`);
  } catch (err) {
    log.warn("candidate_summary.failed", { jobId, candidateId, err });
    await withOrg(orgId, (tx) => tx`
      update candidate_summaries set status = 'failed', error = ${err instanceof Error ? err.message.slice(0, 300) : "failed"}
      where job_id = ${jobId} and candidate_id = ${candidateId} and fingerprint = ${fp}`);
  }
}

type Material = {
  text: string;
  requirements: string[];
  sources: Map<string, SummarySource>;
  /** Interviewer comments and notes by source id, to check quotes are word for word. */
  comments: Map<string, { text: string; interviewer: string; round: string; human_interview_id: string }>;
  headline: Omit<StoredSummary["headline"], "requirements_met">;
};

/** Collect every round's results in the prompt's text form, with a source id for each piece of evidence. */
async function gather(orgId: string, jobId: string, p: CandidatePipeline): Promise<Material> {
  const sources = new Map<string, SummarySource>();
  const comments: Material["comments"] = new Map();
  const blocks: string[] = [];
  let ratings: number[] = [];
  let recommends = 0;
  let scorecards = 0;

  const { job, reports, cards } = await withOrg(orgId, async (tx) => {
    const [job] = await tx<{ required_skills: string[]; parsed_requirements: { skills?: { name: string; importance: string }[] } | null }[]>`
      select required_skills, parsed_requirements from jobs where id = ${jobId}`;
    const aiIds = p.results.filter((r) => r.entry?.kind === "ai").map((r) => r.entry!.id);
    const humanIds = p.results.filter((r) => r.entry?.kind === "human").map((r) => r.entry!.id);
    const reports = aiIds.length ? await tx<{ interview_id: string; report_json: StoredReport | null }[]>`
      select interview_id, report_json from interview_reports where interview_id = any(${aiIds}) and status = 'completed'` : [];
    const cards = humanIds.length ? await tx<(Scorecard & { human_interview_id: string })[]>`
      select s.human_interview_id, s.user_id, u.name, s.ratings, s.notes, s.recommendation
      from human_interview_scorecards s join users u on u.id = s.user_id
      where s.human_interview_id = any(${humanIds}) and s.submitted_at is not null order by s.submitted_at` : [];
    return { job, reports, cards };
  });

  p.results.forEach((r, i) => {
    const rid = `R${i + 1}`;
    const e = r.entry!;
    const head = `Round ${rid}: "${r.round.name}" (${e.kind === "ai" ? "AI interview" : "human interview"}), marked ${DECISION_LABEL[r.decision!]}${e.decision_note ? `. Decision note: ${e.decision_note}` : ""}`;
    if (e.kind === "ai") {
      const report = reports.find((x) => x.interview_id === e.id)?.report_json;
      if (!report) { blocks.push(`${head}\n(No report available.)`); return; }
      const ref = (s: string) => `${rid}-${s}`;
      for (const [key, v] of Object.entries(report.refs ?? {})) sources.set(ref(key), { kind: "ai", round: r.round.name, interview_id: e.id, ms: v.start_ms });
      const lines = [
        head,
        `Summary: ${report.final.summary}`,
        `Section assessments: ${report.sections.map((s) => `${s.name}: ${s.assessment ?? "not assessed"}`).join("; ")}`,
        `Strengths:\n${report.final.strengths.map((s) => `- ${s.point} [${s.evidence_refs.map(ref).join(", ")}]`).join("\n") || "(none)"}`,
        `Areas to explore:\n${report.final.areas_to_explore.map((a) => `- ${a.point} (${a.reason})`).join("\n") || "(none)"}`,
        `Evidence:\n${report.final.key_evidence.filter((k) => k.segment_ref).map((k) => `${ref(k.segment_ref!)} [${formatClock(k.timestamp_start_ms)}] ${k.claim}: "${k.quote_or_paraphrase}"`).join("\n") || "(none)"}`,
      ];
      blocks.push(lines.join("\n"));
    } else {
      const mine = cards.filter((c) => c.human_interview_id === e.id);
      const lines = [head];
      mine.forEach((c, j) => {
        const id = `${rid}-I${j + 1}`;
        sources.set(id, { kind: "human", round: r.round.name, human_interview_id: e.id, interviewer: c.name });
        scorecards++;
        if (c.recommendation === "qualified") recommends++;
        ratings = ratings.concat(c.ratings.map((x) => x.rating).filter((x): x is number => typeof x === "number"));
        const said = [...c.ratings.map((x) => x.comment ?? ""), c.notes ?? ""].filter(Boolean).join("\n");
        comments.set(id, { text: said, interviewer: c.name, round: r.round.name, human_interview_id: e.id });
        const card = [
          `Recommendation: ${c.recommendation ? DECISION_LABEL[c.recommendation] : "none"}`,
          ...c.ratings.map((x) => `${x.criterion}: ${x.rating ?? "-"}/5${x.comment ? ` — ${x.comment}` : ""}`),
          c.notes ? `Notes: ${c.notes}` : "",
        ].filter(Boolean).join("\n");
        lines.push(`Interviewer ${id} (${c.name}):\n${untrusted("scorecard", card, 4000)}`);
      });
      if (!mine.length) lines.push("(No submitted scorecards.)");
      blocks.push(lines.join("\n"));
    }
  });

  const required = job?.required_skills?.length
    ? job.required_skills
    : (job?.parsed_requirements?.skills ?? []).filter((s) => s.importance === "required").map((s) => s.name);
  return {
    text: blocks.join("\n\n"),
    requirements: required.slice(0, 20),
    sources,
    comments,
    headline: {
      rounds: p.results.length,
      ai_rounds: p.results.filter((r) => r.round.kind === "ai").length,
      human_rounds: p.results.filter((r) => r.round.kind === "human").length,
      average_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      recommends,
      scorecards,
      requirements_total: Math.min(required.length, 20),
    },
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”"]/g, "").trim();

/** Keep only sources and quotes that really exist in the input; count requirements ourselves. */
export function finalize(s: OverallSummary, m: Pick<Material, "sources" | "comments" | "requirements" | "headline">): StoredSummary {
  const pick = (ids: string[]) => [...new Set(ids)].map((id) => m.sources.get(id)).filter((x): x is SummarySource => !!x).slice(0, 4);
  const listed = new Map(m.requirements.map((r) => [norm(r), r]));
  const evidenced = new Set(s.requirements.filter((r) => r.evidenced && listed.has(norm(r.requirement))).map((r) => norm(r.requirement)));
  const c = s.interviewer_quote ? m.comments.get(s.interviewer_quote.source_id) : undefined;
  const quoteOk = !!(c && s.interviewer_quote && norm(s.interviewer_quote.quote).length >= 8 && norm(c.text).includes(norm(s.interviewer_quote.quote)));
  return {
    version: 1,
    prompt_version: OVERALL_SUMMARY_VERSION,
    headline: { ...m.headline, requirements_met: m.requirements.length && s.requirements.length ? evidenced.size : null },
    summary: s.summary,
    highlights: s.highlights.slice(0, 4).map((h) => ({ point: h.point, sources: pick(h.source_ids) })),
    concern: s.concern ? { point: s.concern.point, sources: pick(s.concern.source_ids) } : null,
    quote: quoteOk ? { text: s.interviewer_quote!.quote.trim().replace(/^["“]|["”]$/g, ""), interviewer: c!.interviewer, round: c!.round, human_interview_id: c!.human_interview_id } : null,
    missing_requirements: s.requirements.length ? m.requirements.filter((r) => !evidenced.has(norm(r))) : [],
  };
}
