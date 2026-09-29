import { describe, expect, it } from "vitest";
import { isReservedTestAddress } from "@/lib/email/recipients";

describe("isReservedTestAddress", () => {
  it("flags reserved and test-only domains", () => {
    for (const address of [
      "e2e.abc@e2e.filewell.test",
      "a@example.test",
      "a@foo.example",
      "a@bar.invalid",
      "a@app.localhost",
      "a@localhost",
      "a@example.com",
      "a@example.org",
      "a@example.net",
      "a@mail.example.com",
      "A@EXAMPLE.COM",
      "a@example.com.",
    ]) {
      expect(isReservedTestAddress(address), address).toBe(true);
    }
  });

  it("allows real domains, including ones that merely contain a reserved word", () => {
    for (const address of [
      "owner@gmail.com",
      "support@getfilewell.com",
      "a@example.co",
      "a@myexample.com",
      "a@testing.com",
      "a@contest.io",
      "a@invalidation.net",
    ]) {
      expect(isReservedTestAddress(address), address).toBe(false);
    }
  });

  it("does not treat a malformed value as reserved (the provider rejects it)", () => {
    expect(isReservedTestAddress("not-an-email")).toBe(false);
    expect(isReservedTestAddress("trailing@")).toBe(false);
  });
});
