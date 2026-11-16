import { describe, expect, it } from "vitest";
import { categoryAssignment } from "./campaigns.js";

describe("categoryAssignment", () => {
  it("accepts a new campaign category without a key", () => {
    const parsed = categoryAssignment.safeParse({
      new: true,
      label: "Dakrenovatie",
      amountCentsOverride: 4500,
      aiHints: "Het dak moet vervangen of gerenoveerd worden.",
    });

    expect(parsed.success).toBe(true);
  });

  it("still accepts an existing category by key", () => {
    expect(categoryAssignment.safeParse({ key: "dakrenovatievervangen", amountCentsOverride: null }).success).toBe(true);
  });

  it("keeps the new fields in the request body", () => {
    const parsed = categoryAssignment.parse({ new: true, label: "Klein werk", amountCentsOverride: 1000, aiHints: null });

    expect(parsed).toEqual({ new: true, label: "Klein werk", amountCentsOverride: 1000, aiHints: null });
  });
});
