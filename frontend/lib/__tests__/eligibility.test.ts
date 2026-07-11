import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "../eligibility";

describe("evaluateEligibility", () => {
  it("returns no verdict with reason and alternative when a rule matches", () => {
    const result = evaluateEligibility(
      {
        rules: [
          {
            if: { size: ["large"] },
            verdict: "no",
            why: "Программа для МСБ.",
            alt: "brk-loan",
          },
        ],
        default: "yes",
      },
      { size: "large" }
    );

    expect(result).toEqual({ kind: "no", why: "Программа для МСБ.", alt: "brk-loan" });
  });

  it("falls back to default yes when no rule matches", () => {
    expect(evaluateEligibility({ rules: [], default: "yes" }, { size: "small" })).toEqual({
      kind: "yes",
    });
  });

  it("supports positive rules and default no", () => {
    expect(
      evaluateEligibility(
        { rules: [{ if: { industry: ["agro"] }, verdict: "yes" }], default: "no" },
        { industry: "agro" }
      )
    ).toEqual({ kind: "yes" });
    expect(evaluateEligibility({ rules: [], default: "no" }, {})).toEqual({ kind: "no" });
  });
});
