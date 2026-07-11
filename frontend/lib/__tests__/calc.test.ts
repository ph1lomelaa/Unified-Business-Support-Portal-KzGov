import { describe, expect, it } from "vitest";
import { cattleRuleOk, economySimple } from "../calc";

describe("calc", () => {
  it("checks the 70 percent cattle financing rule", () => {
    expect(cattleRuleOk(70, 100)).toBe(true);
    expect(cattleRuleOk(69, 100)).toBe(false);
    expect(cattleRuleOk(10, 0)).toBe(false);
  });

  it("calculates simple subsidy economy", () => {
    expect(economySimple(10_000_000, 19, 7, 24)).toBe(2_400_000);
  });
});
