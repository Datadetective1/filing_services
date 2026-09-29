import { describe, expect, it } from "vitest";
import { lookupSchema } from "@/lib/lookup/pending";

describe("pending lookup schema", () => {
  it("round-trips: a parsed value parses again (the cookie stores the parsed form)", () => {
    const first = lookupSchema.parse({
      stateCode: "PA",
      entityType: "llc",
      legalName: "  Keystone Bakery LLC ",
      formationDate: "",
      entityNumber: "",
      isForeign: false,
      isNonprofit: false,
      alreadyFiledThisYear: false,
    });
    expect(first.entityNumber).toBeNull();
    expect(first.formationDate).toBeNull();
    const second = lookupSchema.safeParse(JSON.parse(JSON.stringify(first)));
    expect(second.success).toBe(true);
    expect(second.data).toEqual(first);
  });

  it("keeps provided values", () => {
    const v = lookupSchema.parse({ stateCode: "PA", entityType: "corporation", legalName: "Acme Inc", formationDate: "2020-05-01", entityNumber: "123-45" });
    expect(v.entityNumber).toBe("123-45");
    expect(lookupSchema.parse(v)).toEqual(v);
  });

  it("rejects bad entity numbers and unknown entity types", () => {
    expect(lookupSchema.safeParse({ stateCode: "PA", entityType: "llc", legalName: "A", entityNumber: "12 34" }).success).toBe(false);
    expect(lookupSchema.safeParse({ stateCode: "PA", entityType: "sole_prop", legalName: "A" }).success).toBe(false);
  });
});
