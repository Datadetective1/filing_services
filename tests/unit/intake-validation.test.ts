import { describe, expect, it } from "vitest";
import { PENNSYLVANIA_RULES } from "@/lib/compliance/states/pennsylvania";
import type { IntakeSchema } from "@/lib/compliance/types";
import type { EntityType } from "@/lib/domain/types";
import { formatRegisteredOffice, type IntakeAnswers, validateAll, validateSection } from "@/lib/intake/validate";

function schemaFor(entityType: EntityType): IntakeSchema {
  const rule = PENNSYLVANIA_RULES.find((r) => r.entityType === entityType);
  if (!rule) throw new Error(`missing PA rule ${entityType}`);
  return rule.intake;
}

const llc = schemaFor("llc");
const corporation = schemaFor("corporation");

function validLlcAnswers(): IntakeAnswers {
  return {
    legal_name: "  Acme   Holdings LLC ",
    entity_number: "1234567",
    jurisdiction_of_formation: "Pennsylvania",
    registered_office: {
      mode: "address",
      line1: "100 Market St",
      city: "Harrisburg",
      region: "PA",
      postal_code: "17101",
      county: "Dauphin",
    },
    principal_office: {
      line1: "200 Main Street, Suite 4",
      city: "Wilmington",
      region: "de",
      postal_code: "19801-1234",
    },
    governors: [{ name: "Jane Owner", title: "Managing Member" }],
    principal_officers: [],
    changes_since_last_report: "no",
    state_notice_email: "",
  };
}

describe("PA intake validation (registry schema)", () => {
  it("accepts a complete, valid LLC intake and normalizes values", () => {
    const r = validateAll(llc, validLlcAnswers());
    expect(r.errors).toEqual({});
    expect(r.ok).toBe(true);
    expect(r.incompleteSections).toEqual([]);
    expect(r.values.legal_name).toBe("Acme Holdings LLC");
    expect((r.values.principal_office as { region: string }).region).toBe("DE");
    expect(r.values.registered_office).toMatchObject({ mode: "address", region: "PA", county: "Dauphin" });
  });

  it("requires at least one governor", () => {
    const a = validLlcAnswers();
    a.governors = [];
    const r = validateAll(llc, a);
    expect(r.ok).toBe(false);
    expect(r.incompleteSections).toContain("people");
    expect(r.errors.governors).toMatch(/at least one/i);

    const b = validLlcAnswers();
    delete b.governors;
    expect(validateAll(llc, b).errors.governors).toMatch(/at least one/i);
  });

  it("rejects a P.O. box as the principal office street address", () => {
    for (const line1 of ["P.O. Box 123", "PO Box 9", "post office box 77", "p o box 5"]) {
      const a = validLlcAnswers();
      a.principal_office = { ...(a.principal_office as object), line1 };
      const r = validateAll(llc, a);
      expect(r.ok, line1).toBe(false);
      expect(r.errors["principal_office.line1"]).toMatch(/P\.O\. box/);
    }
  });

  it("allows a P.O. box on line 2 alongside a street address", () => {
    const a = validLlcAnswers();
    a.principal_office = { ...(a.principal_office as object), line2: "PO Box 12" };
    expect(validateAll(llc, a).ok).toBe(true);
  });

  it("requires the registered office to be in Pennsylvania and not a P.O. box", () => {
    const a = validLlcAnswers();
    a.registered_office = { ...(a.registered_office as object), region: "NJ" };
    const r = validateAll(llc, a);
    expect(r.ok).toBe(false);
    expect(r.errors["registered_office.region"]).toMatch(/PA/);

    const b = validLlcAnswers();
    b.registered_office = { ...(b.registered_office as object), line1: "PO Box 1" };
    expect(validateAll(llc, b).errors["registered_office.line1"]).toBeTruthy();

    const c = validLlcAnswers();
    c.registered_office = { ...(c.registered_office as object), county: "" };
    expect(validateAll(llc, c).errors["registered_office.county"]).toMatch(/County is required/);
  });

  it("accepts a commercial registered office provider with a county, and requires both", () => {
    const ok = validLlcAnswers();
    ok.registered_office = { mode: "crop", crop_name: "Registered Agents Inc.", county: "Dauphin" };
    const r = validateAll(llc, ok);
    expect(r.ok).toBe(true);
    expect(formatRegisteredOffice(r.values.registered_office as never)).toContain("commercial registered office provider");

    const bad = validLlcAnswers();
    bad.registered_office = { mode: "crop", crop_name: "", county: "" };
    const e = validateAll(llc, bad).errors;
    expect(e["registered_office.crop_name"]).toMatch(/Provider name is required/);
    expect(e["registered_office.county"]).toMatch(/County is required/);
    // Errors come only from the branch the customer chose.
    expect(e["registered_office.line1"]).toBeUndefined();
  });

  it("requires at least one principal officer for a corporation but not for an LLC", () => {
    const a = { ...validLlcAnswers(), governors: [{ name: "Sam Director", title: "Director" }], principal_officers: [] };
    const corpResult = validateAll(corporation, a);
    expect(corpResult.ok).toBe(false);
    expect(corpResult.errors.principal_officers).toMatch(/at least one/i);

    const withOfficer = { ...a, principal_officers: [{ name: "Sam Director", title: "President" }] };
    expect(validateAll(corporation, withOfficer).ok).toBe(true);
    expect(validateAll(llc, validLlcAnswers()).ok).toBe(true);
  });

  it("validates the entity number pattern but allows it to be blank", () => {
    for (const bad of ["ABC 123", "12/34", "<script>", "a".repeat(31)]) {
      const a = { ...validLlcAnswers(), entity_number: bad };
      expect(validateAll(llc, a).errors.entity_number, bad).toBeTruthy();
    }
    for (const ok of ["", "0012345", "A1-B2"]) {
      expect(validateAll(llc, { ...validLlcAnswers(), entity_number: ok }).ok, ok).toBe(true);
    }
    const missing = validLlcAnswers();
    delete missing.entity_number;
    expect(validateAll(llc, missing).ok).toBe(true);
  });

  it("validates ZIP codes", () => {
    for (const zip of ["1710", "171011", "ABCDE", "17101-12"]) {
      const a = validLlcAnswers();
      a.principal_office = { ...(a.principal_office as object), postal_code: zip };
      expect(validateAll(llc, a).errors["principal_office.postal_code"], zip).toMatch(/ZIP/);
    }
  });

  it("rejects state codes that are not U.S. states", () => {
    const a = validLlcAnswers();
    a.principal_office = { ...(a.principal_office as object), region: "ZZ" };
    expect(validateAll(llc, a).errors["principal_office.region"]).toMatch(/U\.S\. state/);
  });

  it("ignores fully empty people rows but validates partially filled ones", () => {
    const a = validLlcAnswers();
    a.governors = [
      { name: "Jane Owner", title: "Member" },
      { name: "", title: "" },
      { name: "   ", title: "" },
    ];
    const r = validateAll(llc, a);
    expect(r.ok).toBe(true);
    expect(r.values.governors).toEqual([{ name: "Jane Owner", title: "Member" }]);

    const b = validLlcAnswers();
    b.governors = [{ name: "Jane Owner", title: "" }];
    expect(validateAll(llc, b).errors["governors.0.title"]).toMatch(/Title is required/);
  });

  it("requires legal name and jurisdiction, and validates optional email and choice fields", () => {
    const a = { ...validLlcAnswers(), legal_name: "   ", jurisdiction_of_formation: "" };
    const e = validateAll(llc, a).errors;
    expect(e.legal_name).toMatch(/Legal name is required/);
    expect(e.jurisdiction_of_formation).toBeTruthy();

    expect(validateAll(llc, { ...validLlcAnswers(), state_notice_email: "not-an-email" }).errors.state_notice_email).toMatch(
      /valid email/,
    );
    expect(validateAll(llc, { ...validLlcAnswers(), changes_since_last_report: "maybe" }).errors.changes_since_last_report).toBe(
      "Choose an option",
    );
  });

  it("validates a single section independently", () => {
    const record = llc.sections.find((s) => s.key === "record")!;
    const r = validateSection(record, { legal_name: "Acme LLC", jurisdiction_of_formation: "Pennsylvania" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ legal_name: "Acme LLC", entity_number: "", jurisdiction_of_formation: "Pennsylvania" });
  });

  it("reports every incomplete section for empty answers", () => {
    const r = validateAll(llc, {});
    expect(r.ok).toBe(false);
    expect(r.incompleteSections).toEqual(expect.arrayContaining(["record", "registered_office", "principal_office", "people"]));
    expect(r.incompleteSections).not.toContain("extras");
  });
});
