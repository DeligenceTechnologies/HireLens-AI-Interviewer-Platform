import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { withOrg, type Tx } from "@/lib/database/db";
import { COUNTED_STATUSES, RUNNING_STATUSES, WAITING_STATUSES } from "./quota";

// Interview rounds: the ordered interviews a job runs (e.g. Screening →
// Technical → Culture fit), each with its own template.

export const MAX_ROUNDS = 10;

export const RoundInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name each round").max(80),
  template_id: z.string().uuid("Choose a template for each round"),
});
export type RoundInput = z.infer<typeof RoundInputSchema>;

export type RoundRow = {
  id: string; name: string; template_id: string | null; template_name: string | null; minutes: number;
  sort_order: number; interviews: number; completed: number;
};

/** A candidate's history in one round, for the invite dialog. */
export type CandidateRoundState = { completedAt: Date | null; completedCount: number; pending: boolean; started: number };

export async function listRounds(orgId: string, jobId: string) {
  return withOrg(orgId, (tx) => tx<RoundRow[]>`
    select r.id, r.name, r.template_id, t.name as template_name, r.sort_order,
      coalesce((select sum(s.duration_minutes) from interview_template_sections s where s.template_id = r.template_id and s.enabled), 0)::int as minutes,
      (select count(*)::int from interviews i where i.round_id = r.id and i.status <> 'cancelled') as interviews,
      (select count(*)::int from interviews i where i.round_id = r.id and i.status::text = any(${COUNTED_STATUSES})) as completed
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
  await assertTemplates(tx, orgId, rounds.map((r) => r.template_id));
  const existing = new Set((await tx<{ id: string }[]>`select id from job_rounds where job_id = ${jobId}`).map((r) => r.id));
  const keep: string[] = [];
  for (const [i, r] of rounds.entries()) {
    if (r.id && existing.has(r.id)) {
      await tx`update job_rounds set name = ${r.name}, template_id = ${r.template_id}, sort_order = ${i} where id = ${r.id}`;
      keep.push(r.id);
    } else {
      const [row] = await tx<{ id: string }[]>`
        insert into job_rounds (organization_id, job_id, name, template_id, sort_order) values (${orgId}, ${jobId}, ${r.name}, ${r.template_id}, ${i}) returning id`;
      keep.push(row.id);
    }
  }
  await tx`delete from job_rounds where job_id = ${jobId} and id <> all(${keep})`;
  await tx`update jobs set interview_template_id = ${rounds[0].template_id} where id = ${jobId}`;
}
