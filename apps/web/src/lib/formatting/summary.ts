/** Picks one currency's totals out of the API's per-currency summary (ETB first, else the first entry). */
export function pickSummary<T extends { currency: string }>(summary: T[] | undefined, currency = 'ETB'): T | undefined {
  return summary?.find((entry) => entry.currency === currency) ?? summary?.[0];
}
