import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { json, withOrg, type Tx } from "@/lib/database/db";
import { MAX_CRITERIA } from "@/lib/hiring";
import { COUNTED_STATUSES, RUNNING_STATUSES, WAITING_STATUSES } from "./quota";

// Interview rounds: the ordered interviews a job runs (e.g. Screening →
// Technical → Culture fit). An AI round uses a template; a human round is
// scheduled with team members, who rate the candidate on its criteria.

export const MAX_ROUNDS = 10;

export const RoundInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name each round").max(80),
  kind: z.enum(["ai", "human"]).default("ai"),
  template_id: z.string().uuid("Choose a template for each round").nullable().optional(),
  criteria: z.array(z.string().trim().min(1).max(80)).max(MAX_CRITERIA).default([]),
  guide: z.string().trim().max(4000).nullable().optional(),
}).superRefine((r, ctx) => {
  if (r.kind === "ai" && !r.template_id) ctx.addIssue({ code: "custom", path: ["template_id"], message: "Choose a template for each AI round" });
  if (r.kind === "human" && !r.criteria.length) ctx.addIssue({ code: "custom", path: ["criteria"], message: "Add at least one thing to assess in each human round" });
});
/** Rounds without a kind are AI rounds (the only kind before human interviews). */
export type RoundInput = z.input<typeof RoundInputSchema>;

export type RoundRow = {
  id: string; name: string; kind: "ai" | "human"; template_id: string | null; template_name: string | null; minutes: number;
  criteria: string[]; guide: string | null; sort_order: number; interviews: number; completed: number;
};

/** A candidate's history in one round, for the invite dialog. */
export type CandidateRoundState = { completedAt: Date | null; completedCount: number; pending: boolean; started: number };

export async function listRounds(orgId: string, jobId: string) {
  return withOrg(orgId, (tx) => tx<RoundRow[]>`
    select r.id, r.name, r.kind, r.template_id, t.name as template_name, r.sort_order, r.criteria, r.guide,
      coalesce((select sum(s.duration_minutes) from interview_template_sections s where s.template_id = r.template_id and s.enabled), 0)::int as minutes,
      case when r.kind = 'human'
        then (select count(*)::int from human_interviews h where h.round_id = r.id and h.status <> 'cancelled')
        else (select count(*)::int from interviews i where i.round_id = r.id and i.status <> 'cancelled') end as interviews,
      case when r.kind = 'human'
        then (select count(*)::int from human_interviews h where h.round_id = r.id and h.status = 'completed')
        else (select count(*)::int from interviews i where i.round_id = r.id and i.status::text = any(${COUNTED_STATUSES})) end as completed
    from job_rounds r left join interview_templates t on t.id = r.template_id
    where r.job_id = ${jobId} and r.organization_id = ${orgId}
    order by r.sort_order, r.created_at`);
}

/** Per-round state for one candidate (completed? pending invite? attempts started). */
export async function candidateRoundStates(orgId: string, jobId: string, candidateId: string) {
  const rows = await withOrg(orgId, (tx) => tx<{ round_id: string | null; status: string; completed_at: Date | null; started_at: Date | null; token_expires_at: Date | null }[]>`
    select round_id, status, completed_at, started_at, token_expires_at from interviews
    where job_id = ${jobId} and candidate_id = ${candidateId} and organization_id = ${orgId}`);
  const out: Record<string, CandidateRoundState> = {};
  for (const r of rows) {
    if (!r.round_id) continue;
    const s = (out[r.round_id] ??= { completedAt: null, completedCount: 0, pending: false, started: 0 });
    if (COUNTED_STATUSES.includes(r.status)) {
      s.completedCount += 1;
      if (!s.completedAt || (r.completed_at && r.completed_at > s.completedAt)) s.completedAt = r.completed_at;
    }
    if (isOpen(r)) s.pending = true;
    if (r.started_at) s.started += 1;
  }
  return out;
}

/** Sent but not finished, with a link that still works (or already running). */
export function isOpen(i: { status: string; token_expires_at: Date | null }) {
  return RUNNING_STATUSES.includes(i.status)
    || (WAITING_STATUSES.includes(i.status) && (!i.token_expires_at || i.token_expires_at.getTime() > Date.now()));
}

async function assertTemplates(tx: Tx, orgId: string, ids: string[]) {
  const found = await tx<{ id: string }[]>`select id from interview_templates where organization_id = ${orgId} and id = any(${ids})`;
  if (found.length !== new Set(ids).size) throw new ApiError(400, "A selected interview template was not found.");
}

/**
 * Replace a job's rounds with `rounds` (in order): updates kept rounds, adds
 * new ones and removes the rest. Interviews of a removed round keep its name.
 * Also keeps jobs.interview_template_id pointing at the first round's template.
 */
export async function saveRounds(tx: Tx, orgId: string, jobId: string, rounds: RoundInput[]) {
  if (!rounds.length) throw new ApiError(400, "Add at least one interview round.");
  if (rounds.length > MAX_ROUNDS) throw new ApiError(400, `A job can have up to ${MAX_ROUNDS} interview rounds.`);
  const templateIds = rounds.filter((r) => r.kind !== "human").map((r) => r.template_id!);
  if (templateIds.length) await assertTemplates(tx, orgId, templateIds);
  const existing = new Set((await tx<{ id: string }[]>`select id from job_rounds where job_id = ${jobId}`).map((r) => r.id));
  const keep: string[] = [];
  for (const [i, r] of rounds.entries()) {
    const human = r.kind === "human";
    const templateId = human ? null : r.template_id!;
    const criteria = json(human ? r.criteria ?? [] : []);
    const guide = human ? r.guide || null : null;
    const kind = human ? "human" : "ai";
    if (r.id && existing.has(r.id)) {
      await tx`update job_rounds set name = ${r.name}, kind = ${kind}, template_id = ${templateId}, criteria = ${criteria}, guide = ${guide}, sort_order = ${i} where id = ${r.id}`;
      keep.push(r.id);
    } else {
      const [row] = await tx<{ id: string }[]>`
        insert into job_rounds (organization_id, job_id, name, kind, template_id, criteria, guide, sort_order)
        values (${orgId}, ${jobId}, ${r.name}, ${kind}, ${templateId}, ${criteria}, ${guide}, ${i}) returning id`;
      keep.push(row.id);
    }
  }
  await tx`delete from job_rounds where job_id = ${jobId} and id <> all(${keep})`;
  await tx`update jobs set interview_template_id = ${templateIds[0] ?? null} where id = ${jobId}`;
}
