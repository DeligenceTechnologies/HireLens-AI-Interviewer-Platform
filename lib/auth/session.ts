import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { withSystem } from "@/lib/database/db";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { can, type Permission, type Role } from "./permissions";

export const SESSION_COOKIE = "aii_session";
const SESSION_TTL_DAYS = 14;

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
  sessionId: string;
  isPlatformAdmin: boolean;
};

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function createSession(userId: string, orgId: string | null): Promise<void> {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await withSystem((tx) => tx`
    insert into sessions (user_id, organization_id, token_hash, expires_at)
    values (${userId}, ${orgId}, ${hashToken(token)}, ${expires})`);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await withSystem((tx) => tx`delete from sessions where token_hash = ${hashToken(token)}`);
  jar.delete(SESSION_COOKIE);
}

/** Resolve the current user + active organization. Cached per request. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await withSystem((tx) => tx<{
    session_id: string; user_id: string; email: string; name: string; org_id: string | null;
    org_name: string | null; org_slug: string | null; role: Role | null; expires_at: Date; last_seen_at: Date;
    is_platform_admin: boolean; disabled_at: Date | null;
  }[]>`
    select s.id as session_id, u.id as user_id, u.email, u.name, o.id as org_id, o.name as org_name,
           o.slug as org_slug, case when o.id is null then null else m.role end as role, s.expires_at, s.last_seen_at,
           u.is_platform_admin, u.disabled_at
    from sessions s
    join users u on u.id = s.user_id
    left join organization_members m on m.user_id = u.id and m.organization_id = s.organization_id
    left join organizations o on o.id = m.organization_id and o.status = 'active'
    where s.token_hash = ${hashToken(token)}`);
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now() || row.disabled_at) return null;
  if (!row.org_id || !row.role) {
    // Session points at an org the user left (or that was suspended): fall back to another active membership.
    const m = await withSystem((tx) => tx<{ org_id: string; org_name: string; org_slug: string; role: Role }[]>`
      select o.id as org_id, o.name as org_name, o.slug as org_slug, m.role
      from organization_members m join organizations o on o.id = m.organization_id
      where m.user_id = ${row.user_id} and o.status = 'active' order by m.created_at limit 1`);
    if (!m[0]) return null;
    await withSystem((tx) => tx`update sessions set organization_id = ${m[0].org_id} where id = ${row.session_id}`);
    Object.assign(row, m[0]);
  }
  if (Date.now() - row.last_seen_at.getTime() > 10 * 60_000) {
    await withSystem((tx) => tx`update sessions set last_seen_at = now() where id = ${row.session_id}`);
  }
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    orgId: row.org_id!,
    orgName: row.org_name!,
    orgSlug: row.org_slug!,
    role: row.role!,
    sessionId: row.session_id,
    isPlatformAdmin: row.is_platform_admin,
  };
});

export type SessionUser = { userId: string; email: string; name: string; isPlatformAdmin: boolean; hasCompany: boolean };

/** The signed-in person, whether or not they belong to an active company (platform admins may not). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await withSystem((tx) => tx<{ user_id: string; email: string; name: string; is_platform_admin: boolean; has_company: boolean }[]>`
    select u.id as user_id, u.email, u.name, u.is_platform_admin,
      exists (select 1 from organization_members m join organizations o on o.id = m.organization_id
              where m.user_id = u.id and o.status = 'active') as has_company
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now() and u.disabled_at is null`);
  if (!row) return null;
  return { userId: row.user_id, email: row.email, name: row.name, isPlatformAdmin: row.is_platform_admin, hasCompany: row.has_company };
});

/** For admin pages: only platform admins; everyone else gets a 404. */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isPlatformAdmin) notFound();
  return user;
}

/** For admin route handlers. */
export async function requirePlatformAdminApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Not signed in");
  if (!user.isPlatformAdmin) throw new AuthError(403, "You don't have permission to do that");
  return user;
}

/** For server components/pages: redirect to login when signed out. */
export async function requireAuth(permission?: Permission): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (permission && !can(auth.role, permission)) redirect("/dashboard?denied=1");
  return auth;
}

/** For route handlers: throw AuthError instead of redirecting. */
export async function requireApiAuth(permission?: Permission): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new AuthError(401, "Not signed in");
  if (permission && !can(auth.role, permission)) throw new AuthError(403, "You don't have permission to do that");
  return auth;
}
