import { afterEach, describe, expect, it, vi } from "vitest";
import { soqlContainsAll } from "@/lib/registry/pa-open-data-map";
import { searchPaRegister } from "@/lib/registry/pa-open-data";
import { searchStateRegister } from "@/lib/registry/state-open-data";

describe("contains-every-word condition", () => {
  it("splits on spaces and punctuation, skips suffixes and one-letter words, longest words first", () => {
    expect(soqlContainsAll("upper(business_name)", "Joe's Pizza LLC")).toBe(
      "upper(business_name) like '%PIZZA%' AND upper(business_name) like '%JOE%'",
    );
    expect(soqlContainsAll("f", "The Lancaster Bakery, Inc.")).toBe("f like '%LANCASTER%' AND f like '%BAKERY%'");
  });

  it("only lets letters and digits into the query and caps it at four words", () => {
    const where = soqlContainsAll("f", "a'b%c_d one two three four five")!;
    expect(where).not.toMatch(/'%[^A-Z0-9%]/);
    expect(where.split(" AND ")).toHaveLength(4);
    expect(where).not.toContain("_");
    expect(soqlContainsAll("f", "LLC Inc")).toBeNull();
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("search fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("PA: no prefix match and a slow second query reads as no match, not an outage", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json([]))
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchPaRegister("Quietbrook Bakery")).resolves.toEqual([]);
    const second = new URL(String(fetchMock.mock.calls[1][0]));
    expect(second.searchParams.get("$q")).toBeNull();
    expect(second.searchParams.get("$where")).toBe("upper(business_name) like '%QUIETBROOK%' AND upper(business_name) like '%BAKERY%'");
  });

  it("PA: finds names that contain the words when none start with them", async () => {
    const row = { business_name: "THE QUIETBROOK FAMILY BAKERY LLC", filing_number: "7123456", typeofbusinessregistration: "Domestic Limited Liability Company", city: "Lancaster", state: "PA" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([row])));
    const hits = await searchPaRegister("Quietbrook Family");
    expect(hits).toHaveLength(1);
    expect(hits[0].entityNumber).toBe("7123456");
  });

  it("PA: the register not answering the first query is still an outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    await expect(searchPaRegister("Stillwater Roofing")).rejects.toThrow(/didn't respond/);
  });

  it("other states: a slow full-text fallback reads as no match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([])).mockRejectedValueOnce(new DOMException("timeout", "TimeoutError")));
    await expect(searchStateRegister("CO", "Quietbrook Bakery")).resolves.toEqual([]);
  });
});
