import "server-only";
import { aiIsLive } from "@/lib/env";
import { OverallSummarySchema, type OverallSummary } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/overall-summary/v1";
import { AI_CONFIG } from "./config";
import { runStructured } from "./openai-client";

export const OVERALL_SUMMARY_VERSION = prompt.version;

/** Round material in the prompt's text form, with source ids (R1-S12, R2-I1) for evidence. */
export type SummaryInput = { orgId: string; jobTitle: string; requirements: string[]; rounds: string; roundNames: string[] };

export async function generateOverallSummary(input: SummaryInput): Promise<{ summary: OverallSummary; source: "openai" | "mock" }> {
  if (!aiIsLive()) return { summary: mockOverallSummary(input), source: "mock" };
  const summary = await runStructured({
    orgId: input.orgId,
    feature: "overall_summary",
    model: AI_CONFIG.overallSummary,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser(input),
    schema: OverallSummarySchema,
    schemaName: "overall_summary",
    reasoningEffort: "low",
  });
  return { summary, source: "openai" };
}

/** Demo mode (no OpenAI key): a factual placeholder, clearly labelled. */
function mockOverallSummary(input: SummaryInput): OverallSummary {
  return {
    summary: `The candidate was marked Qualified in every round (${input.roundNames.join(", ")}). This summary was generated in demo mode without AI; open each round for the details.`,
    highlights: [],
    concern: null,
    interviewer_quote: null,
    requirements: [],
  };
}
