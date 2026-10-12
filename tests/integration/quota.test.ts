import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg, withSystem } from "@/lib/database/db";
import { assertQuotaAvailable, getQuotaStatus } from "@/lib/services/quota";

// Runs against the local database. Each run uses its own throwaway company.
const id = Date.now().toString(36);
let orgId = "";
let jobId = "";
let n = 0;

async function addInterview(status: string, extra: { completedAt?: string; expiresAt?: string } = {}) {
  n += 1;
  await withSystem(async (tx) => {
    const [c] = await tx<{ id: string }[]>`insert into candidates (organization_id, name, email) values (${orgId}, ${`C${n}`}, ${`c${n}-${id}@quota.test`}) returning id`;
    await tx`insert into interviews (organization_id, job_id, candidate_id, secure_token_hash, status, completed_at, token_expires_at)
      values (${orgId}, ${jobId}, ${c.id}, ${`quota-${id}-${n}`}, ${status}::interview_status,
              ${extra.completedAt ?? null}::timestamptz, ${extra.expiresAt ?? null}::timestamptz)`;
  });
}

beforeAll(async () => {
  await withSystem(async (tx) => {
    const [o] = await tx<{ id: string }[]>`
      insert into organizations (name, slug, interview_quota, quota_counted_from)
      values (${`Quota Co ${id}`}, ${`quota-co-${id}`}, 3, now() - interval '1 day') returning id`;
    orgId = o.id;
    const [j] = await tx<{ id: string }[]>`insert into jobs (organization_id, title, status) values (${orgId}, 'Quota job', 'active') returning id`;
    jobId = j.id;
  });
});

afterAll(async () => {
  await withSystem((tx) => tx`delete from organizations where id = ${orgId}`);
});

describe("free-interview quota", () => {
  it("counts completed interviews since the start date and holds slots for unfinished ones", async () => {
    await addInterview("completed", { completedAt: new Date().toISOString() });
    await addInterview("report_ready", { completedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }); // before counting started
    await addInterview("invited", { expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    await addInterview("invited", { expiresAt: new Date(Date.now() - 86_400_000).toISOString() }); // expired link: frees its slot
    await addInterview("cancelled");
    await addInterview("failed");
    const q = await getQuotaStatus(orgId);
    expect(q).toMatchObject({ quota: 3, used: 1, inProgress: 1, remaining: 1 });
  });

  it("blocks when used + in progress reaches the quota", async () => {
    await addInterview("in_progress");
    expect((await getQuotaStatus(orgId)).remaining).toBe(0);
    await expect(withOrg(orgId, (tx) => assertQuotaAvailable(tx, orgId))).rejects.toThrow(/used all your free interviews/);
  });

  it("only lets one of two simultaneous invites take the last slot", async () => {
    await withSystem((tx) => tx`update organizations set interview_quota = 4 where id = ${orgId}`);
    const attempt = () => withOrg(orgId, async (tx) => {
      await assertQuotaAvailable(tx, orgId);
      const [c] = await tx<{ id: string }[]>`insert into candidates (organization_id, name, email) values (${orgId}, 'Race', ${`race-${Math.random()}@quota.test`}) returning id`;
      await tx`insert into interviews (organization_id, job_id, candidate_id, secure_token_hash, status) values (${orgId}, ${jobId}, ${c.id}, ${`race-${Math.random()}`}, 'created')`;
    });
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getQuotaStatus(orgId)).remaining).toBe(0);
  });

  it("treats a null quota as unlimited", async () => {
    await withSystem((tx) => tx`update organizations set interview_quota = null where id = ${orgId}`);
    const q = await getQuotaStatus(orgId);
    expect(q.remaining).toBeNull();
    await expect(withOrg(orgId, (tx) => assertQuotaAvailable(tx, orgId))).resolves.toBeUndefined();
  });
});
