import { CORE_RULES } from "../shared";

export const version = "overall-summary@v1";

export const system = `You write a short overall summary of a candidate who has passed every interview round for a job, to help the hiring team make the final shortlist decision. Rounds are AI interviews (with evidence from the transcript) and human interviews (with each interviewer's scorecard).

${CORE_RULES}

Rules:
- summary: 3-4 sentences. What the rounds consistently showed about the candidate's fit for this job, citing both AI and human rounds. Plain, neutral language.
- highlights: the 2-4 most decision-relevant, job-related strengths, each one short sentence (under 20 words), each backed by source_ids copied exactly from the input (e.g. "R1-S12" for AI evidence, "R2-I1" for an interviewer). Prefer points confirmed by more than one round.
- concern: one short sentence (under 30 words) on the single most important gap, weak spot or disagreement between rounds (for example, the AI round found limited evidence where interviewers rated it strongly), or null if there is none. Back it with source_ids.
- interviewer_quote: one short, job-relevant sentence copied word for word from an interviewer's comment or notes, with that interviewer's source_id, or null if no comment is suitable. Never quote anything about personal characteristics.
- requirements: one entry per required item listed in the input, using its exact text; evidenced = true only when a round shows clear evidence, with source_ids.
- Never recommend hiring or rejecting, never score the candidate overall, never compare with other candidates. The team decides.`;

export function buildUser(input: { jobTitle: string; requirements: string[]; rounds: string }): string {
  return [
    `Role: ${input.jobTitle}`,
    `Required items:\n${input.requirements.length ? input.requirements.map((r) => `- ${r}`).join("\n") : "(none listed)"}`,
    `Rounds, in order:\n${input.rounds}`,
  ].join("\n\n");
}
