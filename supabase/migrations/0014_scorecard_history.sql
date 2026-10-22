-- Scorecards keep their earlier versions, so edits made after a round decision
-- was reopened stay visible to the team.
select set_config('app.system', 'on', true);

alter table human_interview_scorecards
  -- [{ ratings, notes, recommendation, submitted_at, replaced_at }], oldest first
  add column versions jsonb not null default '[]'::jsonb,
  add column edited_after_decision boolean not null default false;
