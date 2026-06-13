import { describe, expect, it } from "vitest";
import {
  bedsNeededFor,
  confidenceFor,
  intakeStatus,
  rankResources,
} from "./matcher";
import { SEED_RESOURCES } from "./resources";
import type { Resource } from "./types";

// A fixed evening time so tests are deterministic regardless of when they run.
const EVENING = new Date("2026-06-13T19:30:00-07:00");

function resource(overrides: Partial<Resource>): Resource {
  return {
    id: "r",
    name: "Test",
    type: "shelter",
    address: "1 Main",
    city: "San José",
    zip: "95112",
    lat: 37.3522,
    lng: -121.8847,
    phone: "+14085550000",
    hours: { 0: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 1: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 2: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 3: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 4: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 5: { open: "17:00", close: "08:00", intakeCutoff: "21:00" }, 6: { open: "17:00", close: "08:00", intakeCutoff: "21:00" } },
    servesFamilies: true,
    familyCapacity: 4,
    genderPolicy: "any",
    adaAccessible: true,
    allowsPets: false,
    sobrietyRequired: false,
    totalBeds: 50,
    openBeds: 10,
    lastVerifiedAt: null,
    verifyMethod: "seed",
    ...overrides,
  };
}

describe("bedsNeededFor", () => {
  it("defaults to one bed", () => expect(bedsNeededFor({})).toBe(1));
  it("counts a parent plus children", () =>
    expect(bedsNeededFor({ family: true, childrenCount: 2 })).toBe(3));
  it("honors an explicit count", () =>
    expect(bedsNeededFor({ bedsNeeded: 5 })).toBe(5));
});

describe("confidenceFor", () => {
  it("treats never-verified seed data as low confidence", () =>
    expect(confidenceFor(resource({ lastVerifiedAt: null }), Date.now())).toBeCloseTo(0.35, 5));
  it("trusts a just-verified resource fully", () => {
    const now = Date.now();
    expect(confidenceFor(resource({ lastVerifiedAt: now }), now)).toBeCloseTo(1, 2);
  });
  it("decays over time", () => {
    const now = Date.now();
    const fresh = confidenceFor(resource({ lastVerifiedAt: now - 10 * 60_000 }), now);
    const old = confidenceFor(resource({ lastVerifiedAt: now - 240 * 60_000 }), now);
    expect(fresh).toBeGreaterThan(old);
  });
});

describe("intakeStatus", () => {
  it("is open before the cutoff", () => {
    const s = intakeStatus(resource({}), new Date("2026-06-13T19:30:00-07:00"));
    expect(s.intakeOpenNow).toBe(true);
    expect(s.minutesToCutoff).toBe(90);
  });
  it("is closed after the cutoff", () => {
    const s = intakeStatus(resource({}), new Date("2026-06-13T22:00:00-07:00"));
    expect(s.intakeOpenNow).toBe(false);
  });
  it("reports closed when there are no hours that day", () => {
    const r = resource({ hours: { ...resource({}).hours, 6: null } });
    const s = intakeStatus(r, new Date("2026-06-13T19:30:00-07:00")); // 2026-06-13 is a Saturday
    expect(s.openToday).toBe(false);
  });
});

describe("rankResources — hard eligibility filters", () => {
  it("never routes a family to a men-only or youth shelter", () => {
    const results = rankResources(
      { family: true, childrenCount: 2, zip: "95035", urgency: "tonight" },
      SEED_RESOURCES,
      EVENING,
    );
    expect(results.length).toBeGreaterThan(0);
    for (const m of results) {
      expect(m.resource.servesFamilies).toBe(true);
      expect(["men", "youth"]).not.toContain(m.resource.genderPolicy);
    }
  });

  it("respects an ADA requirement", () => {
    const results = rankResources(
      { gender: "man", ada: true, zip: "95112" },
      SEED_RESOURCES,
      EVENING,
    );
    expect(results.every((m) => m.resource.adaAccessible)).toBe(true);
    // CityTeam is men-only but NOT ADA-accessible — must be filtered out.
    expect(results.find((m) => m.resource.id === "cityteam-sj")).toBeUndefined();
  });

  it("excludes resources with no last-known space", () => {
    const full = resource({ id: "full", openBeds: 0 });
    const open = resource({ id: "open", openBeds: 5 });
    const results = rankResources({ zip: "95112" }, [full, open], EVENING);
    expect(results.map((m) => m.resource.id)).toEqual(["open"]);
  });
});

describe("rankResources — scoring", () => {
  it("ranks a recently-verified resource above an identical stale one", () => {
    const now = EVENING.getTime();
    const stale = resource({ id: "stale", lastVerifiedAt: null });
    const fresh = resource({ id: "fresh", lastVerifiedAt: now - 60_000 });
    const results = rankResources({ zip: "95112" }, [stale, fresh], EVENING);
    expect(results[0].resource.id).toBe("fresh");
  });

  it("penalizes an option that cannot be reached before intake closes", () => {
    // Tight cutoff + far away + no car => reachability tanks the score.
    const lateCutoff = { open: "17:00", close: "08:00", intakeCutoff: "19:45" };
    const hours = { 0: lateCutoff, 1: lateCutoff, 2: lateCutoff, 3: lateCutoff, 4: lateCutoff, 5: lateCutoff, 6: lateCutoff };
    const near = resource({ id: "near", zip: "95112", lat: 37.4337, lng: -121.8949, hours });
    const far = resource({ id: "far", lat: 37.4636, lng: -122.1444, hours }); // East Palo Alto
    const results = rankResources(
      { zip: "95035", noCar: true, urgency: "tonight" },
      [near, far],
      EVENING,
    );
    const nearScore = results.find((m) => m.resource.id === "near")!.score;
    const farScore = results.find((m) => m.resource.id === "far")!.score;
    expect(nearScore).toBeGreaterThan(farScore);
  });

  it("attaches human-readable reasons to every result", () => {
    const results = rankResources(
      { family: true, childrenCount: 2, ada: true, zip: "95035", urgency: "tonight" },
      SEED_RESOURCES,
      EVENING,
    );
    expect(results[0].reasons.length).toBeGreaterThan(0);
    expect(results[0].reasons.some((r) => r.includes("Family"))).toBe(true);
  });
});
