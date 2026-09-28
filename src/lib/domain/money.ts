export function formatCents(cents: number, opts: { trimZeros?: boolean } = {}): string {
  if (!Number.isInteger(cents)) throw new Error("Money must be an integer number of cents");
  const dollars = cents / 100;
  const trim = opts.trimZeros && cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: trim ? 0 : 2,
    maximumFractionDigits: trim ? 0 : 2,
  }).format(dollars);
}
