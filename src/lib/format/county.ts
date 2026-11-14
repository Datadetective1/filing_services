/**
 * "Lehigh" -> "Lehigh County". Customers often type the word themselves ("Lehigh County"),
 * so never add it twice. Louisiana parishes and Alaska boroughs keep their own word.
 */
export function countyLabel(county: string): string {
  const c = county.replace(/\s+/g, " ").trim();
  if (!c) return c;
  return /\b(county|parish|borough)$/i.test(c) ? c : `${c} County`;
}
