-- Platform (super) admin: manage companies, users, access requests and
-- free-interview quotas across all tenants. Every new table here is
-- system-only: the server reads and writes it, companies never can.

alter table users
  add column is_platform_admin boolean not null default false,
  add column disabled_at timestamptz;

alter table organizations
  add column status text not null default 'active' check (status in ('active', 'suspended')),
  add column suspended_at timestamptz,
  -- Completed interviews allowed since quota_counted_from; null = unlimited.
  add column interview_quota integer default 3 check (interview_quota >= 0),
  add column quota_counted_from timestamptz not null default now(),
  add column admin_notes text;

-- Existing companies start with the default quota, counted from go-live,
-- so interviews completed before today don't count against them.
update organizations set interview_quota = 3, quota_counted_from = now();

-- Access requests become a reviewable queue.
alter table access_requests
  add column notes text,
  add column reviewed_by uuid references users(id) on delete set null,
  add column reviewed_at timestamptz,
  add constraint access_requests_status_check check (status in ('new', 'contacted', 'approved', 'rejected'));

-- One-time links that let an approved client create their company.
create table company_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  company_name text not null,
  email citext not null,
  interview_quota integer check (interview_quota >= 0),
  access_request_id uuid references access_requests(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_invites_created_idx on company_invites(created_at desc);

create table platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_logs_created_idx on platform_audit_logs(created_at desc);

do $$
declare t text;
begin
  foreach t in array array['company_invites', 'platform_settings', 'platform_audit_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy system_only on %I using (app_is_system()) with check (app_is_system())', t);
  end loop;
end $$;
