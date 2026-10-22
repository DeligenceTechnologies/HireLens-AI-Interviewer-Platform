import "server-only";
import { ApiError } from "@/lib/api";
import { withOrg, type Tx } from "@/lib/database/db";
import { getTrialSettings } from "./platform";

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
  plan: "standard" | "trial";
  trialEndsAt: Date | null;
  trialEnded: boolean;
  /** Whole days left in a trial (0 once ended); null when not a trial. */
  trialDaysLeft: number | null;
  /** Trial accounts waiting to confirm their email (only when verification is switched on). */
  needsVerification: boolean;
};

/** Interview statuses that count against the quota (once completed_at is past quota_counted_from). */
export const COUNTED_STATUSES = ["completed", "processing", "report_ready"];
/** Not-yet-started statuses that hold a slot while their link is still valid. */
export const WAITING_STATUSES = ["created", "invited", "consent_pending", "device_check", "ready"];
export const RUNNING_STATUSES = ["in_progress", "completing"];

export const QUOTA_EXCEEDED_MESSAGE = "You've used all your free interviews. Contact us to add more.";
export const TRIAL_ENDED_MESSAGE = "Your free trial has ended. Book a call with us to continue.";
export const VERIFY_EMAIL_MESSAGE = "Confirm your email to start sending interviews. Check your inbox for the link.";

async function readQuota(tx: Tx, orgId: string, opts: { lock?: boolean; excludeInterviewId?: string } = {}): Promise<QuotaStatus> {
  const [org] = await tx<{ interview_quota: number | null; quota_counted_from: Date; plan: "standard" | "trial"; trial_ends_at: Date | null; verified: boolean }[]>`
    select interview_quota, quota_counted_from, plan, trial_ends_at,
      exists (select 1 from organization_members m join users u on u.id = m.user_id
              where m.organization_id = organizations.id and u.email_verified_at is not null) as verified
    from organizations where id = ${orgId}
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
  const trial = org.plan === "trial";
  const needsVerification = trial && !org.verified && (await getTrialSettings()).requireVerification;
  return {
    quota: org.interview_quota, used: c.used, inProgress: c.in_progress, remaining, countedFrom: org.quota_counted_from,
    plan: org.plan, trialEndsAt: org.trial_ends_at, trialEnded: trial && !!org.trial_ends_at && org.trial_ends_at <= new Date(), needsVerification,
    trialDaysLeft: trial && org.trial_ends_at ? Math.max(0, Math.ceil((org.trial_ends_at.getTime() - Date.now()) / 86_400_000)) : null,
  };
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
  if (q.trialEnded) throw new ApiError(403, TRIAL_ENDED_MESSAGE, "trial_ended");
  if (q.needsVerification) throw new ApiError(403, VERIFY_EMAIL_MESSAGE, "email_unverified");
  if (q.remaining !== null && q.remaining <= 0) throw new ApiError(403, QUOTA_EXCEEDED_MESSAGE, "quota_exceeded");
}
