import "server-only";
import { ApiError } from "@/lib/api";
import { withOrg, type Tx } from "@/lib/database/db";

// Free-interview quota per company. An interview counts once it's completed
// (since quota_counted_from). Interviews that are sent but not finished hold a
// slot, so a company can't send more invites than it has interviews left.
// Cancelled, failed and expired-unused invites hold nothing.

export type QuotaStatus = {
  /** null = unlimited */
  quota: number | null;
  used: number;
  inProgress: number;
  /** null = unlimited */
  remaining: number | null;
  countedFrom: Date;
};

/** Interview statuses that count against the quota (once completed_at is past quota_counted_from). */
export const COUNTED_STATUSES = ["completed", "processing", "report_ready"];
/** Not-yet-started statuses that hold a slot while their link is still valid. */
export const WAITING_STATUSES = ["created", "invited", "consent_pending", "device_check", "ready"];
export const RUNNING_STATUSES = ["in_progress", "completing"];

export const QUOTA_EXCEEDED_MESSAGE = "You've used all your free interviews. Contact us to add more.";

async function readQuota(tx: Tx, orgId: string, opts: { lock?: boolean; excludeInterviewId?: string } = {}): Promise<QuotaStatus> {
  const [org] = await tx<{ interview_quota: number | null; quota_counted_from: Date }[]>`
    select interview_quota, quota_counted_from from organizations where id = ${orgId}
    ${opts.lock ? tx`for update` : tx``}`;
  if (!org) throw new ApiError(404, "Company not found");
  const [c] = await tx<{ used: number; in_progress: number }[]>`
    select
      count(*) filter (where status::text = any(${COUNTED_STATUSES}) and completed_at >= ${org.quota_counted_from})::int as used,
      count(*) filter (where status::text = any(${RUNNING_STATUSES})
        or (status::text = any(${WAITING_STATUSES}) and (token_expires_at is null or token_expires_at > now())))::int as in_progress
    from interviews
    where organization_id = ${orgId}
      ${opts.excludeInterviewId ? tx`and id <> ${opts.excludeInterviewId}` : tx``}`;
  const remaining = org.interview_quota == null ? null : Math.max(0, org.interview_quota - c.used - c.in_progress);
  return { quota: org.interview_quota, used: c.used, inProgress: c.in_progress, remaining, countedFrom: org.quota_counted_from };
}

export async function getQuotaStatus(orgId: string): Promise<QuotaStatus> {
  return withOrg(orgId, (tx) => readQuota(tx, orgId));
}

/**
 * Throw when the company has no interview left to send. Locks the company row
 * so two invites sent at the same moment can't both take the last slot.
 * `excludeInterviewId` is for re-activating an existing interview (new link).
 */
export async function assertQuotaAvailable(tx: Tx, orgId: string, excludeInterviewId?: string) {
  const q = await readQuota(tx, orgId, { lock: true, excludeInterviewId });
  if (q.remaining !== null && q.remaining <= 0) throw new ApiError(403, QUOTA_EXCEEDED_MESSAGE, "quota_exceeded");
}
