/**
 * One money format everywhere: "ETB 12,500" (decimals only when the amount has them).
 * Amounts arrive from the API as decimal strings.
 */
export function formatMoney(amount: string | number | null | undefined, currency = 'ETB'): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(safe) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);

  return `${currency} ${formatted}`;
}

export function toNumber(amount: string | number | null | undefined): number {
  const value = Number(amount ?? 0);

  return Number.isFinite(value) ? value : 0;
}
