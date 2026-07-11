export function cattleRuleOk(cattleAmount: number, loanAmount: number): boolean {
  if (loanAmount <= 0) return false;
  return cattleAmount >= loanAmount * 0.7;
}

export function economySimple(
  amount: number,
  bankRate: number,
  programRate: number,
  months: number
): number {
  return amount * (bankRate - programRate) / 100 * months / 12;
}
