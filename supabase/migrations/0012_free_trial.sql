-- Self-serve free trial: a company can sign up without an access code and
-- gets a small number of interviews for a limited time. Email verification is
-- built in but switched on from the admin area once email sending is set up.
select set_config('app.system', 'on', true);

alter table organizations
  add column plan text not null default 'standard' check (plan in ('standard', 'trial')),
  add column trial_ends_at timestamptz,
  -- Email domain of the person who started the trial (one trial per company domain).
  add column signup_domain citext;
create index organizations_signup_domain_idx on organizations(signup_domain) where signup_domain is not null;

alter table users add column email_verified_at timestamptz;
-- Everyone who signed up before trials came via an invite or an approval, so treat them as verified.
update users set email_verified_at = created_at where email_verified_at is null;

create table email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_verifications_user_idx on email_verifications(user_id, created_at desc);
alter table email_verifications enable row level security;
alter table email_verifications force row level security;
create policy system_only on email_verifications using (app_is_system()) with check (app_is_system());
