import { describe, expect, it } from "vitest";
import { extractConstraints, isCrisis, mergeConstraints } from "./constraints";

describe("extractConstraints — English", () => {
  it("reads the golden-path message", () => {
    const c = extractConstraints("I need somewhere to sleep tonight. I have my 2 kids and no car.");
    expect(c).toMatchObject({ urgency: "tonight", family: true, childrenCount: 2, noCar: true });
  });

  it("detects a family from singular/soft phrasings (no LLM needed)", () => {
    expect(extractConstraints("just me and my little one, on foot").family).toBe(true);
    expect(extractConstraints("nowhere to crash tonight with my little boy").family).toBe(true);
    expect(extractConstraints("my son and I have nowhere to go").family).toBe(true);
  });

  it("reads 'family of N'", () => {
    const c = extractConstraints("family of 3 tonight near 95035");
    expect(c).toMatchObject({ family: true, bedsNeeded: 3, urgency: "tonight", zip: "95035" });
  });

  it("captures ADA, pets, gender, zip", () => {
    const c = extractConstraints("i'm a woman in a wheelchair with my dog, 95112");
    expect(c).toMatchObject({ gender: "woman", ada: true, pets: true, zip: "95112" });
  });
});

describe("extractConstraints — Spanish", () => {
  it("reads a full Spanish intake", () => {
    const c = extractConstraints("necesito dormir esta noche con mis 2 hijos, no tengo carro");
    expect(c).toMatchObject({ urgency: "tonight", family: true, childrenCount: 2, noCar: true });
  });
});

describe("isCrisis", () => {
  it("flags English + Spanish self-harm signals", () => {
    expect(isCrisis("i dont want to live anymore")).toBe(true);
    expect(isCrisis("quiero morir")).toBe(true);
    expect(isCrisis("i need a bed tonight")).toBe(false);
  });
});

describe("mergeConstraints", () => {
  it("never unsets earlier info", () => {
    const prev = { family: true, childrenCount: 2 };
    const next = { zip: "95035" };
    expect(mergeConstraints(prev, next)).toMatchObject({ family: true, childrenCount: 2, zip: "95035" });
  });
});
