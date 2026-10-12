import "server-only";
import { json, withSystem, type Tx } from "@/lib/database/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { hashToken } from "@/lib/security/tokens";

// Platform-wide settings managed from the admin area. Until an admin saves
// them, the sign-up code falls back to the SIGNUP_ACCESS_CODE env variable.

export const DEFAULT_INTERVIEW_QUOTA = 3;

export type SignupCodeSetting = { enabled: boolean; code: string | null };

async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await withSystem((tx) => tx<{ value: T }[]>`select value from platform_settings where key = ${key}`);
  return row?.value ?? null;
}

export async function getSignupCode(): Promise<SignupCodeSetting> {
  const saved = await readSetting<SignupCodeSetting>("signup_code");
  if (saved) return saved;
  const code = env().SIGNUP_ACCESS_CODE ?? null;
  return { enabled: !!code, code };
}

/** Quota for newly created companies; null = unlimited. */
export async function getDefaultQuota(): Promise<number | null> {
  const saved = await readSetting<{ value: number | null }>("default_quota");
  return saved ? saved.value : DEFAULT_INTERVIEW_QUOTA;
}

export async function writeSetting(tx: Tx, key: string, value: unknown, adminId: string) {
  await tx`
    insert into platform_settings (key, value, updated_by, updated_at) values (${key}, ${json(value)}, ${adminId}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
}

/** Record a platform admin action. Never throws (same contract as the tenant audit log). */
export async function platformAudit(tx: Tx, entry: { adminId: string; action: string; targetType: string; targetId?: string | null; details?: Record<string, unknown> }) {
  try {
    await tx`savepoint paudit_sp`;
    await tx`
      insert into platform_audit_logs (admin_user_id, action, target_type, target_id, details)
      values (${entry.adminId}, ${entry.action}, ${entry.targetType}, ${entry.targetId ?? null}, ${json(entry.details ?? {})})`;
    await tx`release savepoint paudit_sp`;
  } catch (err) {
    await tx`rollback to savepoint paudit_sp`.catch(() => {});
    log.warn("platform_audit.write_failed", { action: entry.action, err });
  }
}

export type CompanyInvite = { id: string; company_name: string; email: string; interview_quota: number | null };

/** A usable one-time company sign-up link, or null. */
export async function getCompanyInvite(token: string): Promise<CompanyInvite | null> {
  const [row] = await withSystem((tx) => tx<CompanyInvite[]>`
    select id, company_name, email, interview_quota from company_invites
    where token_hash = ${hashToken(token)} and used_at is null and revoked_at is null and expires_at > now()`);
  return row ?? null;
}
