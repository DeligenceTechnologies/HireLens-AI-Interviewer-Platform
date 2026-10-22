-- Hiring decisions and human interviews.
--  * Each interview (AI or human) can be marked Qualified / Not qualified / On hold.
--  * job_candidates tracks a candidate's overall outcome for a job
--    (In progress → Shortlisted → Hired, or Rejected / Withdrawn).
--  * A job round can be a human interview: scheduled with a meeting link,
--    run by team members, who each fill in a scorecard.
select set_config('app.system', 'on', true);

-- Round decision on AI interviews
alter table interviews
  add column decision text check (decision in ('qualified', 'not_qualified', 'on_hold')),
  add column decision_note text,
  add column decided_by uuid references users(id) on delete set null,
  add column decided_at timestamptz;

-- A candidate's progress in one job
create table job_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  stage text not null default 'in_progress' check (stage in ('in_progress', 'shortlisted', 'hired', 'rejected', 'withdrawn')),
  stage_note text,
  stage_changed_by uuid references users(id) on delete set null,
  stage_changed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index job_candidates_org_idx on job_candidates(organization_id, stage);
create index job_candidates_candidate_idx on job_candidates(candidate_id);

-- Everyone already interviewed for a job is in progress for it.
insert into job_candidates (organization_id, job_id, candidate_id, created_at)
select organization_id, job_id, candidate_id, min(created_at) from interviews group by organization_id, job_id, candidate_id
on conflict (job_id, candidate_id) do nothing;

-- Human interview rounds: what to assess (criteria) and a guide for the interviewer
alter table job_rounds
  add column kind text not null default 'ai' check (kind in ('ai', 'human')),
  add column criteria jsonb not null default '[]'::jsonb,
  add column guide text;

create table human_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  round_id uuid references job_rounds(id) on delete set null,
  -- Snapshots, so history reads correctly if the round changes later
  round_name text not null,
  criteria jsonb not null default '[]'::jsonb,
  guide text,
  attempt integer not null default 1 check (attempt >= 1),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  timezone text not null,
  location_type text not null check (location_type in ('video', 'phone', 'in_person')),
  location text,
  message text,
  -- Calendar invite revision (bumped on every reschedule/cancel) and change history
  sequence integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  cancel_reason text,
  decision text check (decision in ('qualified', 'not_qualified', 'on_hold')),
  decision_note text,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index human_interviews_job_candidate_idx on human_interviews(job_id, candidate_id);
create index human_interviews_schedule_idx on human_interviews(organization_id, scheduled_at);
create trigger human_interviews_updated before update on human_interviews for each row execute function set_updated_at();

create table human_interview_panel (
  human_interview_id uuid not null references human_interviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  primary key (human_interview_id, user_id)
);
create index human_interview_panel_user_idx on human_interview_panel(user_id);

create table human_interview_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  human_interview_id uuid not null references human_interviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  -- [{ criterion, rating 1-5, comment }]
  ratings jsonb not null default '[]'::jsonb,
  notes text,
  recommendation text check (recommendation in ('qualified', 'not_qualified', 'on_hold')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (human_interview_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['job_candidates', 'human_interviews', 'human_interview_panel', 'human_interview_scorecards'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (app_is_system() or organization_id = app_current_org()) with check (app_is_system() or organization_id = app_current_org())', t);
  end loop;
end $$;
