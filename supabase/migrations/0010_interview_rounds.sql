-- Interview rounds: a job can run several interviews (screening, technical,
-- culture fit…), each with its own template, and a candidate can repeat a round.
select set_config('app.system', 'on', true);

create table job_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Templates in use by open jobs can't be deleted (checked in the app);
  -- closed jobs keep their rounds even if a template is later removed.
  template_id uuid references interview_templates(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_rounds_job_idx on job_rounds(job_id, sort_order);

alter table job_rounds enable row level security;
alter table job_rounds force row level security;
create policy tenant_isolation on job_rounds
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());

alter table interviews
  add column round_id uuid references job_rounds(id) on delete set null,
  -- Snapshot of the round name, so history reads correctly if the round is renamed or removed.
  add column round_name text,
  add column attempt integer not null default 1 check (attempt >= 1);
create index interviews_round_idx on interviews(job_id, candidate_id, round_id);

-- Existing jobs: their template becomes round 1, named after the template.
insert into job_rounds (organization_id, job_id, name, template_id, sort_order)
select j.organization_id, j.id, left(t.name, 80), j.interview_template_id, 0
from jobs j join interview_templates t on t.id = j.interview_template_id;

-- Existing interviews: attach to their job's round when they used its template,
-- otherwise label them with the template they used.
update interviews i set round_id = r.id, round_name = r.name
from job_rounds r
where r.job_id = i.job_id and r.template_id = i.template_id;

update interviews i set round_name = left(coalesce(t.name, 'Interview'), 80)
from interview_templates t
where i.round_name is null and t.id = i.template_id;

update interviews set round_name = 'Interview' where round_name is null;

-- An attempt is a round the candidate actually started; unused invites don't count.
update interviews i set attempt = 1 + (
  select count(*) from interviews p
  where p.job_id = i.job_id and p.candidate_id = i.candidate_id
    and coalesce(p.round_id::text, p.round_name) = coalesce(i.round_id::text, i.round_name)
    and p.started_at is not null and p.created_at < i.created_at
);
