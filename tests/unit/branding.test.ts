import { describe, expect, it } from "vitest";
import { brandStyle, isHexColor, logoUrl, readableTextColor } from "@/lib/branding";

describe("branding helpers", () => {
  it("accepts only lowercase #rrggbb colours", () => {
    expect(isHexColor("#0b5bd3")).toBe(true);
    expect(isHexColor("#0B5BD3")).toBe(false);
    expect(isHexColor("blue")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
  });

  it("picks readable text for the brand colour", () => {
    expect(readableTextColor("#0b5bd3")).toBe("#ffffff");
    expect(readableTextColor("#111827")).toBe("#ffffff");
    expect(readableTextColor("#facc15")).toBe("#0b0f19");
    expect(readableTextColor("#ffffff")).toBe("#0b0f19");
  });

  it("only overrides colours when a brand colour is set", () => {
    expect(brandStyle(null)).toBeUndefined();
    expect(brandStyle("#e11d48")).toMatchObject({ "--primary": "#e11d48", "--primary-foreground": "#ffffff" });
  });

  it("versions the public logo URL so a new upload isn't cached", () => {
    expect(logoUrl("o1", null, null)).toBeNull();
    expect(logoUrl("o1", "2026-10-15T00:00:00Z", "o1/branding/logo.png")).toBe(`/api/public/logo/o1?v=${Date.parse("2026-10-15T00:00:00Z")}`);
  });
});
