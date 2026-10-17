-- The candidate's camera + microphone and the AI interviewer's voice are
-- recorded as separate parts (mixing them in the browser tied the recording to
-- the sound device's clock, which can run slow). The review player plays the
-- interviewer's voice in sync with the video.
alter table recordings
  add column track text not null default 'candidate' check (track in ('candidate', 'interviewer'));
