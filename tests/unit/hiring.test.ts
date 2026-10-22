import { describe, expect, it } from "vitest";
import { formatInZone, utcToZoned, zonedToUtc } from "@/lib/hiring";
import { buildIcs } from "@/lib/ics";
import { roundResults, allQualified, type PipelineRound, type RoundEntry } from "@/lib/services/pipeline";

describe("time zones", () => {
  it("turns a local date and time in a zone into the exact instant", () => {
    expect(zonedToUtc("2026-10-21", "15:00", "Asia/Kolkata")).toBe("2026-10-21T09:30:00.000Z");
    expect(zonedToUtc("2026-10-21", "15:00", "UTC")).toBe("2026-10-21T15:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z"); // daylight time
    expect(zonedToUtc("2026-12-01", "09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z"); // standard time
  });
  it("reads an instant back in the zone", () => {
    expect(utcToZoned("2026-10-21T09:30:00.000Z", "Asia/Kolkata")).toEqual({ date: "2026-10-21", time: "15:00" });
  });
  it("formats in the interview's zone, not the server's", () => {
    expect(formatInZone("2026-10-21T09:30:00.000Z", "Asia/Kolkata", { withZone: false })).toBe("Wed 21 Oct, 3:00 pm");
  });
});

describe("calendar invite", () => {
  const base = { uid: "abc@pickmyhire.ai", start: new Date("2026-10-21T09:30:00Z"), minutes: 45, title: "Technical interview: Hana, Kim", description: "Line 1\nLine 2; ok", location: "https://zoom.us/j/123", now: new Date("2026-10-20T00:00:00Z") };
  it("builds a valid event with escaped text and folded lines", () => {
    const ics = buildIcs({ ...base, sequence: 0, method: "REQUEST" });
    expect(ics).toContain("DTSTART:20261021T093000Z\r\nDTEND:20261021T101500Z");
    expect(ics).toContain("SUMMARY:Technical interview: Hana\\, Kim");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2\; ok");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
  it("cancels with the same UID and a higher sequence", () => {
    const ics = buildIcs({ ...base, sequence: 2, method: "CANCEL" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});

describe("round results", () => {
  const rounds: PipelineRound[] = [
    { id: "r1", job_id: "j", name: "Screening", kind: "ai", sort_order: 0 },
    { id: "r2", job_id: "j", name: "Panel", kind: "human", sort_order: 1 },
  ];
  const entry = (p: Partial<RoundEntry>): RoundEntry => ({
    kind: "ai", id: Math.random().toString(), job_id: "j", candidate_id: "c", round_id: "r1", round_name: "Screening", attempt: 1, status: "report_ready",
    created_at: new Date(), at: null, timezone: null, decision: null, decision_note: null, decided_at: null, decided_by_name: null, ...p,
  });
  it("uses the latest decision in each round and needs every round qualified", () => {
    const res = roundResults(rounds, [
      entry({ decision: "not_qualified", decided_at: new Date("2026-10-01") }),
      entry({ attempt: 2, decision: "qualified", decided_at: new Date("2026-10-05") }),
      entry({ kind: "human", round_id: "r2", status: "scheduled" }),
    ]);
    expect(res.map((r) => [r.decision, r.state])).toEqual([["qualified", "done"], [null, "waiting"]]);
    expect(allQualified(res)).toBe(false);
  });
  it("ignores cancelled interviews", () => {
    const res = roundResults(rounds, [entry({ decision: "qualified", decided_at: new Date() }), entry({ kind: "human", round_id: "r2", status: "cancelled" })]);
    expect(res[1].state).toBe("none");
  });
});
