/** Validate weights sum to 1.0 (±0.01 tolerance) */
export function validateWeights(weights: number[]): boolean {
  const sum = weights.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.01;
}

/** Validate factor weights sum to 100 */
export function validateFactorWeights(factors: { name: string; weight: number }[]): boolean {
  const sum = factors.reduce((a, f) => a + f.weight, 0);
  return Math.abs(sum - 100) < 0.5;
}

/** Format decimal to percentage string */
export function formatPct(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Date distance in months */
export function monthsBetween(d1: Date, d2: Date): number {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}
