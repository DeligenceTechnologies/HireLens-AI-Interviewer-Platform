import { describe, expect, it } from "vitest";
import { FaceFlagTracker, FACE_MATCH_THRESHOLD, faceDistance, faceStatus } from "@/lib/interview/face-rules";

const far = FACE_MATCH_THRESHOLD + 0.2;
const near = FACE_MATCH_THRESHOLD - 0.2;

describe("faceDistance", () => {
  it("is the euclidean distance", () => {
    expect(faceDistance([0, 0], [3, 4])).toBe(5);
    expect(faceDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe("FaceFlagTracker", () => {
  it("flags a mismatch only after two checks in a row, once per episode", () => {
    const t = new FaceFlagTracker();
    expect(t.observe(1, far)).toBeNull();
    expect(t.observe(1, far)).toBe("mismatch");
    expect(t.observe(1, far)).toBeNull();
    expect(t.observe(1, near)).toBeNull(); // clean check ends the episode
    expect(t.observe(1, far)).toBeNull();
    expect(t.observe(1, far)).toBe("mismatch");
  });

  it("ignores a single glitch", () => {
    const t = new FaceFlagTracker();
    expect(t.observe(2, null)).toBeNull();
    expect(t.observe(1, near)).toBeNull();
    expect(t.observe(2, null)).toBeNull();
  });

  it("needs three checks with no face", () => {
    const t = new FaceFlagTracker();
    expect(t.observe(0, null)).toBeNull();
    expect(t.observe(0, null)).toBeNull();
    expect(t.observe(0, null)).toBe("no_face");
  });

  it("flags more than one person", () => {
    const t = new FaceFlagTracker();
    t.observe(2, null);
    expect(t.observe(3, null)).toBe("multiple_faces");
  });

  it("doesn't flag a mismatch without a reference to compare", () => {
    const t = new FaceFlagTracker();
    for (let i = 0; i < 5; i++) expect(t.observe(1, null)).toBeNull();
  });
});

describe("faceStatus", () => {
  it("summarizes the checks", () => {
    expect(faceStatus([])).toBe("not_completed");
    expect(faceStatus([{ kind: "reference" }, { kind: "check_in" }])).toBe("verified");
    expect(faceStatus([{ kind: "reference" }, { kind: "no_face" }])).toBe("needs_review");
    expect(faceStatus([{ kind: "reference" }, { kind: "detector_unavailable" }])).toBe("needs_review");
    expect(faceStatus([{ kind: "reference" }, { kind: "multiple_faces" }, { kind: "mismatch" }])).toBe("mismatch");
  });
});
