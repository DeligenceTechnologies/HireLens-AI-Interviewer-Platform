-- Overall summary for a candidate who has cleared every round of a job: one card
-- to support the shortlist decision. `fingerprint` identifies the round
-- decisions it was built from; when they change, the summary is rebuilt.
create table candidate_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  fingerprint text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  summary jsonb,
  source text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create trigger candidate_summaries_updated before update on candidate_summaries for each row execute function set_updated_at();

alter table candidate_summaries enable row level security;
alter table candidate_summaries force row level security;
create policy tenant_isolation on candidate_summaries
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());
