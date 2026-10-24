-- Face verification: the candidate's selfie at the setup check is the reference face;
-- during the interview the browser compares the live face to it and reports flags.
-- Existing jobs keep it off; new jobs have it on by default.
alter table jobs add column face_verification boolean not null default false;
alter table jobs alter column face_verification set default true;

-- Copied from the job when the reference selfie is taken, so the report shows what applied.
alter table interviews
  add column face_verification boolean not null default false,
  -- 128-number face descriptor of the reference selfie (not an image).
  add column face_descriptor jsonb;

create table face_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  interview_id uuid not null references interviews(id) on delete cascade,
  kind text not null check (kind in ('reference', 'check_in', 'mismatch', 'no_face', 'multiple_faces', 'detector_unavailable')),
  -- Distance to the reference face (lower = more alike); null when no single face was compared.
  distance real,
  -- Interview clock time (ms since start), for jumping to the moment in the video.
  offset_ms integer,
  image_path text,
  created_at timestamptz not null default now()
);
create index face_checks_interview_idx on face_checks(interview_id, created_at);

alter table face_checks enable row level security;
alter table face_checks force row level security;
create policy tenant_isolation on face_checks
  using (app_is_system() or organization_id = app_current_org())
  with check (app_is_system() or organization_id = app_current_org());
