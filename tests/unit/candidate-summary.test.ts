import { describe, expect, it } from "vitest";
import { finalize } from "@/lib/services/candidate-summary";

const material = {
  requirements: ["React", "Node.js", "AWS"],
  sources: new Map([
    ["R1-S3", { kind: "ai" as const, round: "Screening", interview_id: "i1", ms: 61_000 }],
    ["R2-I1", { kind: "human" as const, round: "Panel", human_interview_id: "h1", interviewer: "Ivan" }],
  ]),
  comments: new Map([["R2-I1", { text: "Explains trade-offs clearly.\nStrong ownership", interviewer: "Ivan", round: "Panel", human_interview_id: "h1" }]]),
  headline: { rounds: 2, ai_rounds: 1, human_rounds: 1, average_rating: 4.5, recommends: 1, scorecards: 1, requirements_total: 3 },
};

describe("overall summary checks", () => {
  it("keeps only real sources, real quotes and listed requirements", () => {
    const s = finalize({
      summary: "Consistent across rounds.",
      highlights: [{ point: "Strong React", source_ids: ["R1-S3", "R9-S1", "R2-I1"] }],
      concern: { point: "AWS untested", source_ids: [] },
      interviewer_quote: { quote: "explains trade-offs   clearly", source_id: "R2-I1" },
      requirements: [
        { requirement: "React", evidenced: true, source_ids: ["R1-S3"] },
        { requirement: "node.js", evidenced: true, source_ids: [] },
        { requirement: "Kubernetes", evidenced: true, source_ids: [] },
        { requirement: "AWS", evidenced: false, source_ids: [] },
      ],
    }, material);
    expect(s.highlights[0].sources.map((x) => x.kind)).toEqual(["ai", "human"]);
    expect(s.quote).toMatchObject({ interviewer: "Ivan", round: "Panel" });
    expect(s.headline.requirements_met).toBe(2);
    expect(s.missing_requirements).toEqual(["AWS"]);
  });

  it("drops a quote that isn't word for word", () => {
    const s = finalize({ summary: "x", highlights: [], concern: null, interviewer_quote: { quote: "An outstanding hire, very confident", source_id: "R2-I1" }, requirements: [] }, material);
    expect(s.quote).toBeNull();
    expect(s.headline.requirements_met).toBeNull();
  });
});
