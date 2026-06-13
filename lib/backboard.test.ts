import { describe, expect, it } from "vitest";
import { parseConstraintsJson } from "./backboard";

describe("parseConstraintsJson", () => {
  it("parses a clean JSON object", () => {
    const r = parseConstraintsJson('{"zip":"95035","family":true,"childrenCount":2}');
    expect(r).toEqual({ zip: "95035", family: true, childrenCount: 2 });
  });

  it("extracts JSON embedded in prose / code fences", () => {
    const r = parseConstraintsJson('Here you go:\n```json\n{"urgency":"tonight","noCar":true}\n```');
    expect(r).toEqual({ urgency: "tonight", noCar: true });
  });

  it("whitelists keys and rejects bad types", () => {
    const r = parseConstraintsJson('{"zip":"abc","gender":"alien","ada":"yes","family":true}');
    // bad zip, bad gender, non-boolean ada are dropped; valid family kept
    expect(r).toEqual({ family: true });
  });

  it("returns null when there is no JSON", () => {
    expect(parseConstraintsJson("I cannot help with that")).toBeNull();
  });
});
