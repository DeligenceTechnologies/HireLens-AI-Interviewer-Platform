export const version = "transcription@v1";

const MAX_TERMS = 40;
const MAX_CHARS = 900;

/**
 * Context for live speech-to-text: the role, company, candidate and the names
 * and terms likely to come up (from the job and the parsed resume), so that
 * product names, companies and skills are spelled correctly.
 */
export function buildTranscriptionPrompt(input: { jobTitle: string; companyName: string; candidateName: string; terms: string[] }): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of input.terms) {
    const t = raw.replace(/\s+/g, " ").trim();
    const key = t.toLowerCase();
    if (!t || t.length > 40 || seen.has(key)) continue;
    seen.add(key);
    terms.push(t);
    if (terms.length >= MAX_TERMS) break;
  }
  let prompt = `A job interview for the ${input.jobTitle} role at ${input.companyName}, with the candidate ${input.candidateName}.`;
  if (terms.length) {
    prompt += " Names and terms that may come up:";
    for (const [i, t] of terms.entries()) {
      const next = `${i ? "," : ""} ${t}`;
      if (prompt.length + next.length + 1 > MAX_CHARS) break;
      prompt += next;
    }
    prompt += ".";
  }
  return prompt;
}
