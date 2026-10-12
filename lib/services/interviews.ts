import "server-only";
import { json, withOrg } from "@/lib/database/db";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import { runInBackground } from "@/lib/background";
import { env } from "@/lib/env";
import { emailTemplates, sendEmail } from "@/lib/email";
import { buildInterviewPlan } from "@/lib/interview/plan";
import { generateToken, hashToken } from "@/lib/security/tokens";
import type { StoredPlan, InterviewStatus } from "@/types/interview";
import type { SectionEvaluation } from "@/lib/validation/ai-schemas";
import { readSettings } from "./org-settings";
import { assertQuotaAvailable } from "./quota";

export type InterviewListRow = {
  id: string;
  status: InterviewStatus;
  plan_status: string;
  created_at: Date;
  invited_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_seconds: number | null;
  issue_count: number;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  job_id: string;
  job_title: string;
  report_status: string | null;
};

export const INTERVIEW_PAGE_SIZE = 25;

export async function listInterviews(orgId: string, opts: { q?: string; status?: string; jobId?: string; page?: number; from?: string; to?: string } = {}) {
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const page = Math.max(1, opts.page ?? 1);
  const statusGroup: Record<string, InterviewStatus[]> = {
    pending: ["created", "invited", "consent_pending", "device_check", "ready"],
    in_progress: ["in_progress", "completing"],
    completed: ["completed", "processing", "report_ready"],
    closed: ["cancelled", "expired", "failed"],
  };
  const statuses = opts.status ? statusGroup[opts.status] ?? [opts.status] : null;
  return withOrg(orgId, async (tx) => {
    const where = tx`i.organization_id = ${orgId}
      ${statuses ? tx`and i.status::text = any(${statuses})` : tx``}
      ${opts.jobId ? tx`and i.job_id = ${opts.jobId}` : tx``}
      ${opts.from ? tx`and i.created_at >= ${opts.from}::date` : tx``}
      ${opts.to ? tx`and i.created_at < (${opts.to}::date + 1)` : tx``}
      ${q ? tx`and (c.name ilike ${q} or c.email::text ilike ${q} or j.title ilike ${q})` : tx``}`;
    const rows = await tx<InterviewListRow[]>`
      select i.id, i.status, i.plan_status, i.created_at, i.invited_at, i.started_at, i.completed_at, i.duration_seconds,
        c.id as candidate_id, c.name as candidate_name, c.email as candidate_email, j.id as job_id, j.title as job_title,
        r.status::text as report_status,
        (select count(*)::int from interview_feedback f where f.interview_id = i.id and f.kind = 'issue') as issue_count
      from interviews i join candidates c on c.id = i.candidate_id join jobs j on j.id = i.job_id
      left join interview_reports r on r.interview_id = i.id
      where ${where}
      order by coalesce(i.completed_at, i.started_at, i.created_at) desc
      limit ${INTERVIEW_PAGE_SIZE} offset ${(page - 1) * INTERVIEW_PAGE_SIZE}`;
    const [{ total }] = await tx<{ total: number }[]>`
      select count(*)::int as total from interviews i join candidates c on c.id = i.candidate_id join jobs j on j.id = i.job_id where ${where}`;
    return { rows, total, page, pageSize: INTERVIEW_PAGE_SIZE };
  });
}

/**
 * Create an interview for a candidate + job. Copies the template's section
 * configuration (snapshot) and generates the personalized plan in the background.
 * Returns the one-time plaintext link (only the hash is stored).
 */
export async function createInterview(orgId: string, userId: string, input: { jobId: string; candidateId: string; templateId?: string | null; sendInvite: boolean }) {
  const token = generateToken();
  const result = await withOrg(orgId, async (tx) => {
    const [job] = await tx<{ id: string; title: string; status: string; interview_template_id: string | null }[]>`
      select id, title, status, interview_template_id from jobs where id = ${input.jobId} and organization_id = ${orgId}`;
    if (!job) throw new ApiError(404, "Job not found");
    if (job.status === "closed") throw new ApiError(409, "This job is closed.");
    const [cand] = await tx<{ id: string; name: string; email: string }[]>`
      select id, name, email from candidates where id = ${input.candidateId} and organization_id = ${orgId}`;
    if (!cand) throw new ApiError(404, "Candidate not found");
    const active = await tx`select 1 from interviews where job_id = ${job.id} and candidate_id = ${cand.id}
      and status not in ('cancelled','expired','failed')`;
    if (active.length) throw new ApiError(409, "This candidate already has an interview for this job.");
    await assertQuotaAvailable(tx, orgId);

    const templateId = input.templateId ?? job.interview_template_id
      ?? (await tx<{ id: string }[]>`select id from interview_templates where organization_id = ${orgId} order by is_default desc, created_at limit 1`)[0]?.id;
    if (!templateId) throw new ApiError(400, "Create an interview template first.");
    const sections = await tx<{ id: string; name: string; objective: string; instructions: string; duration_minutes: number; min_questions: number; max_questions: number; max_followups: number; evaluation_criteria: string[]; scoring_enabled: boolean }[]>`
      select * from interview_template_sections where template_id = ${templateId} and organization_id = ${orgId} and enabled order by sort_order`;
    if (!sections.length) throw new ApiError(400, "The selected template has no enabled sections.");

    const [org] = await tx<{ settings: unknown }[]>`select settings from organizations where id = ${orgId}`;
    const settings = readSettings(org?.settings);
    const [iv] = await tx<{ id: string }[]>`
      insert into interviews (organization_id, job_id, candidate_id, template_id, secure_token_hash, token_expires_at, status, created_by)
      values (${orgId}, ${job.id}, ${cand.id}, ${templateId}, ${hashToken(token)},
              now() + make_interval(days => ${settings.invite_expiry_days}), 'created', ${userId})
      returning id`;
    for (const [i, s] of sections.entries()) {
      await tx`insert into interview_sections (organization_id, interview_id, template_section_id, sort_order, name, objective, config)
        values (${orgId}, ${iv.id}, ${s.id}, ${i}, ${s.name}, ${s.objective}, ${json({
          instructions: s.instructions,
          duration_minutes: s.duration_minutes,
          min_questions: s.min_questions,
          max_questions: s.max_questions,
          max_followups: s.max_followups,
          evaluation_criteria: s.evaluation_criteria,
          scoring_enabled: s.scoring_enabled,
        })})`;
    }
    await audit(tx, { orgId, userId, action: "interview.created", entityType: "interview", entityId: iv.id, metadata: { job_id: job.id, candidate_id: cand.id } });
    // Whichever page the invite came from, an open application for this job is now handled.
    await tx`update job_applications set interview_id = ${iv.id},
        status = case when status in ('new', 'shortlisted') then 'interview_invited'::application_status else status end,
        reviewed_by = coalesce(reviewed_by, ${userId}), reviewed_at = coalesce(reviewed_at, now())
      where job_id = ${job.id} and candidate_id = ${cand.id} and organization_id = ${orgId}`;
    return { id: iv.id, candidate: cand, jobTitle: job.title, minutes: sections.reduce((a, s) => a + s.duration_minutes, 0) };
  });

  runInBackground("interview.plan", () => buildInterviewPlan(orgId, result.id));
  const link = interviewLink(token);
  if (input.sendInvite) await sendInvitation(orgId, userId, result.id, link);
  return { id: result.id, link };
}

export function interviewLink(token: string) {
  return `${env().APP_URL}/interview/${token}`;
}

export async function sendInvitation(orgId: string, userId: string, interviewId: string, link: string) {
  const info = await withOrg(orgId, async (tx) => {
    const [row] = await tx<{ status: string; candidate_name: string; candidate_email: string; job_title: string; org_name: string; minutes: number; token_expires_at: Date | null }[]>`
      select i.status, c.name as candidate_name, c.email as candidate_email, j.title as job_title, o.name as org_name, i.token_expires_at,
        (select coalesce(sum((s.config->>'duration_minutes')::int), 0)::int from interview_sections s where s.interview_id = i.id) as minutes
      from interviews i join candidates c on c.id = i.candidate_id join jobs j on j.id = i.job_id join organizations o on o.id = i.organization_id
      where i.id = ${interviewId} and i.organization_id = ${orgId}`;
    if (!row) throw new ApiError(404, "Interview not found");
    if (row.status === "created") await tx`update interviews set status = 'invited', invited_at = now() where id = ${interviewId}`;
    else await tx`update interviews set invited_at = now() where id = ${interviewId}`;
    await audit(tx, { orgId, userId, action: "interview.invited", entityType: "interview", entityId: interviewId });
    return row;
  });
  const tpl = emailTemplates.invitation({
    candidateName: info.candidate_name.split(" ")[0],
    jobTitle: info.job_title,
    companyName: info.org_name,
    minutes: info.minutes,
    link,
    expiresAt: info.token_expires_at,
  });
  await sendEmail({ to: info.candidate_email, subject: tpl.subject, text: tpl.text, orgId });
}

/** Rotate the secure token (old link stops working) and optionally re-send the invite. */
export async function rotateLink(orgId: string, userId: string, interviewId: string, resend: boolean) {
  const token = generateToken();
  await withOrg(orgId, async (tx) => {
    const [{ settings }] = await tx<{ settings: unknown }[]>`select settings from organizations where id = ${orgId}`;
    const days = readSettings(settings).invite_expiry_days;
    await assertQuotaAvailable(tx, orgId, interviewId);
    const [row] = await tx<{ status: string }[]>`
      update interviews set secure_token_hash = ${hashToken(token)}, token_expires_at = now() + make_interval(days => ${days}),
        status = case when status = 'expired' then 'invited'::interview_status else status end
      where id = ${interviewId} and organization_id = ${orgId}
        and status not in ('completed','processing','report_ready','cancelled')
      returning status`;
    if (!row) throw new ApiError(409, "A new link can't be issued for this interview.");
  });
  const link = interviewLink(token);
  if (resend) await sendInvitation(orgId, userId, interviewId, link);
  return link;
}

export async function sendReminder(orgId: string, userId: string, interviewId: string) {
  // Links are stored hashed, so a reminder issues a fresh link.
  const token = generateToken();
  const info = await withOrg(orgId, async (tx) => {
    const [row] = await tx<{ candidate_name: string; candidate_email: string; job_title: string; org_name: string }[]>`
      update interviews i set secure_token_hash = ${hashToken(token)}, last_reminder_at = now()
      from candidates c, jobs j, organizations o
      where i.id = ${interviewId} and i.organization_id = ${orgId} and c.id = i.candidate_id and j.id = i.job_id and o.id = i.organization_id
        and i.status in ('invited','consent_pending','device_check','ready')
      returning c.name as candidate_name, c.email as candidate_email, j.title as job_title, o.name as org_name`;
    if (!row) throw new ApiError(409, "Reminders can only be sent for interviews that haven't started.");
    await audit(tx, { orgId, userId, action: "interview.reminded", entityType: "interview", entityId: interviewId });
    return row;
  });
  const link = interviewLink(token);
  const tpl = emailTemplates.reminder({ candidateName: info.candidate_name.split(" ")[0], jobTitle: info.job_title, companyName: info.org_name, link });
  await sendEmail({ to: info.candidate_email, subject: tpl.subject, text: tpl.text, orgId });
  return link;
}

export async function cancelInterview(orgId: string, userId: string, interviewId: string) {
  await withOrg(orgId, async (tx) => {
    const [row] = await tx`update interviews set status = 'cancelled'
      where id = ${interviewId} and organization_id = ${orgId} and status in ('created','invited','consent_pending','device_check','ready')
      returning id`;
    if (!row) throw new ApiError(409, "Only interviews that haven't started can be cancelled.");
    await audit(tx, { orgId, userId, action: "interview.cancelled", entityType: "interview", entityId: interviewId });
  });
}

export async function regeneratePlan(orgId: string, interviewId: string) {
  const [row] = await withOrg(orgId, (tx) => tx<{ status: string }[]>`select status from interviews where id = ${interviewId} and organization_id = ${orgId}`);
  if (!row) throw new ApiError(404, "Interview not found");
  if (!["created", "invited", "consent_pending", "device_check", "ready"].includes(row.status)) {
    throw new ApiError(409, "The plan can't change after the interview has started.");
  }
  return buildInterviewPlan(orgId, interviewId);
}

export type InterviewDetail = Awaited<ReturnType<typeof getInterviewDetail>>;

export async function getInterviewDetail(orgId: string, interviewId: string) {
  return withOrg(orgId, async (tx) => {
    const [iv] = await tx<{
      id: string; status: InterviewStatus; plan_status: string; plan_error: string | null; created_at: Date; invited_at: Date | null;
      started_at: Date | null; completed_at: Date | null; duration_seconds: number | null; consent_given: boolean;
      consent_timestamp: Date | null; consent_version: string | null; interview_plan: StoredPlan | null; processing_error: string | null;
      token_expires_at: Date | null; updated_at: Date; candidate_id: string; candidate_name: string; candidate_email: string; job_id: string; job_title: string;
      template_name: string | null;
    }[]>`
      select i.id, i.status, i.plan_status, i.plan_error, i.created_at, i.invited_at, i.started_at, i.completed_at, i.duration_seconds,
        i.consent_given, i.consent_timestamp, i.consent_version, i.interview_plan, i.processing_error, i.token_expires_at, i.updated_at,
        c.id as candidate_id, c.name as candidate_name, c.email as candidate_email, j.id as job_id, j.title as job_title,
        t.name as template_name
      from interviews i join candidates c on c.id = i.candidate_id join jobs j on j.id = i.job_id
      left join interview_templates t on t.id = i.template_id
      where i.id = ${interviewId} and i.organization_id = ${orgId}`;
    if (!iv) return null;
    const sections = await tx<{ id: string; sort_order: number; name: string; objective: string; status: string; start_ms: number | null; end_ms: number | null; evaluation_status: string | null; evaluation: (SectionEvaluation & { source?: string }) | null; config: { scoring_enabled: boolean; evaluation_criteria: string[]; duration_minutes: number } }[]>`
      select id, sort_order, name, objective, status, start_ms, end_ms, evaluation_status, evaluation, config from interview_sections
      where interview_id = ${interviewId} order by sort_order`;
    const evaluations = await tx<{ id: string; section_id: string; assessment: string; score: number | null; summary: string; strengths: string[]; concerns: string[] }[]>`
      select id, section_id, assessment, score, summary, strengths, concerns from section_evaluations where interview_id = ${interviewId}`;
    const evidence = await tx<{ id: string; evaluation_id: string; transcript_segment_id: string | null; timestamp_start_ms: number; timestamp_end_ms: number; evidence_text: string }[]>`
      select e.id, e.evaluation_id, e.transcript_segment_id, e.timestamp_start_ms, e.timestamp_end_ms, e.evidence_text
      from evaluation_evidence e join section_evaluations se on se.id = e.evaluation_id
      where se.interview_id = ${interviewId} order by e.timestamp_start_ms`;
    const questions = await tx<{ id: string; section_id: string; question_text: string; question_type: string; is_followup: boolean; parent_question_id: string | null; sequence_number: number; asked_at_ms: number | null; decision: unknown; answer_text: string | null; answer_start_ms: number | null; answer_end_ms: number | null; analysis: unknown }[]>`
      select q.id, q.section_id, q.question_text, q.question_type, q.is_followup, q.parent_question_id, q.sequence_number, q.asked_at_ms, q.decision,
        a.transcript_text as answer_text, a.start_ms as answer_start_ms, a.end_ms as answer_end_ms, a.analysis
      from interview_questions q left join interview_answers a on a.question_id = q.id
      where q.interview_id = ${interviewId} order by q.sequence_number`;
    const [report] = await tx<{ status: string; summary: string | null; report_json: unknown; error: string | null; generated_at: Date | null }[]>`
      select status, summary, report_json, error, generated_at from interview_reports where interview_id = ${interviewId}`;
    const recordings = await tx<{ id: string; part_index: number; offset_ms: number; status: string; duration_seconds: number | null; file_size: number; mime_type: string }[]>`
      select id, part_index, offset_ms, status, duration_seconds, file_size::int, mime_type from recordings
      where interview_id = ${interviewId} and status <> 'deleted' order by part_index`;
    const [{ segment_count }] = await tx<{ segment_count: number }[]>`select count(*)::int as segment_count from transcript_segments where interview_id = ${interviewId}`;
    return { ...iv, sections, evaluations, evidence, questions, report: report ?? null, recordings, segment_count };
  });
}

export async function getTranscript(orgId: string, interviewId: string) {
  return withOrg(orgId, (tx) => tx<{ id: string; section_id: string | null; speaker: "interviewer" | "candidate" | "system"; text: string; start_time_ms: number; end_time_ms: number }[]>`
    select id, section_id, speaker, text, start_time_ms, end_time_ms from transcript_segments
    where interview_id = ${interviewId} and organization_id = ${orgId}
    order by start_time_ms, sequence_number`);
}
