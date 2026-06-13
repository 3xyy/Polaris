import { describe, expect, it } from "vitest";
import { detectLang, routeReply, crisisReply } from "./ai";
import type { MatchResult, Resource } from "./types";

function matchFixture(): MatchResult {
  const resource: Resource = {
    id: "fsh-sj",
    name: "San José Family Shelter",
    type: "shelter",
    address: "692 N King Rd",
    city: "San José",
    zip: "95116",
    lat: 37.36,
    lng: -121.84,
    phone: "+14085550111",
    hours: Object.fromEntries(
      Array.from({ length: 7 }, (_, d) => [d, { open: "17:00", close: "08:00", intakeCutoff: "21:00" }]),
    ),
    servesFamilies: true,
    familyCapacity: 4,
    genderPolicy: "families",
    adaAccessible: true,
    allowsPets: false,
    sobrietyRequired: false,
    totalBeds: 35,
    openBeds: 6,
    lastVerifiedAt: Date.now(),
    verifyMethod: "phone",
  };
  return {
    resource,
    score: 88,
    confidence: 1,
    distanceMi: 5.6,
    etaMin: 18,
    openNow: true,
    minutesToClose: 90,
    reasons: [],
  };
}

describe("detectLang", () => {
  it("flags Spanish", () => expect(detectLang("necesito dormir esta noche")).toBe("es"));
  it("defaults to English", () => expect(detectLang("i need a bed tonight")).toBe("en"));
});

describe("routeReply — the confirmation payoff", () => {
  const constraints = { family: true, childrenCount: 2, noCar: true, urgency: "tonight" as const };

  it("renders the just-confirmed family route in English", () => {
    const msg = routeReply(matchFixture(), constraints, "en", { justConfirmedSeconds: 12 });
    expect(msg).toContain("Confirmed 12s ago");
    expect(msg).toContain("San José Family Shelter");
    expect(msg).toContain("1 adult + 2 children");
    expect(msg).toContain("Intake closes 9 PM");
    expect(msg).toContain("by transit");
    expect(msg).toContain("CALL");
  });

  it("renders in Spanish when asked", () => {
    const msg = routeReply(matchFixture(), constraints, "es", { justConfirmedSeconds: 8 });
    expect(msg).toContain("Confirmado hace 8s");
    expect(msg).toContain("1 adulto + 2 niños");
    expect(msg).toContain("LLAMAR");
  });
});

describe("crisisReply", () => {
  it("routes to 988, not resources", () => {
    expect(crisisReply("en")).toContain("988");
  });
});
