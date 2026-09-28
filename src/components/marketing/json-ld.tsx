const BACKSLASH = String.fromCharCode(92);
const LESS_THAN = /</g;
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * Serializes structured data for a <script type="application/ld+json"> tag.
 * JSON.stringify does not escape HTML, so "<" (and the JS line separators U+2028 and
 * U+2029) are replaced with their JSON unicode escapes (backslash, "u", four hex
 * digits). The payload then cannot close the script tag, and it still parses to the
 * same data.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(LESS_THAN, `${BACKSLASH}u003c`)
    .replace(LINE_SEPARATOR, `${BACKSLASH}u2028`)
    .replace(PARAGRAPH_SEPARATOR, `${BACKSLASH}u2029`);
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
