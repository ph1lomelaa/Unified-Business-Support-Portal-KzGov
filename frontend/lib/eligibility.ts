import type { Eligibility } from "./types";

export type EligibilityVerdict =
  | { kind: "yes" }
  | { kind: "no"; why?: string; alt?: string };

export function evaluateEligibility(
  eligibility: Eligibility,
  answers: Record<string, string>
): EligibilityVerdict {
  for (const rule of eligibility.rules ?? []) {
    const match = Object.entries(rule.if).every(([field, vals]) =>
      vals.includes(answers[field])
    );
    if (match) {
      return rule.verdict === "no"
        ? { kind: "no", why: rule.why, alt: rule.alt }
        : { kind: "yes" };
    }
  }
  return eligibility.default === "no" ? { kind: "no" } : { kind: "yes" };
}
