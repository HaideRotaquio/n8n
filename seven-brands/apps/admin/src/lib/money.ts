export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** "9.99" → 999. Returns null for anything that isn't a plain non-negative amount with ≤2 decimals. */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/^\$/, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
