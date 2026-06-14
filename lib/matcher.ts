import type { Constraints, MatchResult, Resource } from "./types";
import { centroidForZip, distanceMiles, estimateEtaMin } from "./geo";

/**
 * The Polaris matcher.
 *
 * Two stages, deliberately separated so each is easy to reason about and test:
 *   1. HARD FILTERS — eligibility. Getting these wrong is worse than returning nothing
 *      (sending a family to a men-only shelter, or someone in a wheelchair to a place with
 *      stairs, erodes the trust the whole product depends on). A failed hard filter removes
 *      the resource entirely.
 *   2. SOFT SCORE — among eligible options, a transparent weighted blend of proximity,
 *      freshness/trust, availability headroom, and reachability-before-intake-closes.
 *
 * Every result carries `reasons[]` — the human-readable "why" that the SMS reply and the
 * dashboard cards render. The scoring is intentionally simple arithmetic, not a black box.
 */

// Weights sum to 1.0. Tuned so that a slightly-closer shelter never beats a verified one,
// and an option you physically cannot reach before intake closes is pushed to the bottom.
export const WEIGHTS = {
  proximity: 0.3,
  freshness: 0.3,
  availability: 0.15,
  reachability: 0.25,
} as const;

const MAX_USEFUL_MILES = 18; // beyond this, proximity contributes ~0

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Beds a request actually needs: explicit value, else one bed per adult+child, else 1. */
export function bedsNeededFor(c: Constraints): number {
  if (c.bedsNeeded && c.bedsNeeded > 0) return c.bedsNeeded;
  if (c.family || c.childrenCount) return 1 + (c.childrenCount ?? 1);
  return 1;
}

/**
 * Confidence that the availability figure is still true, as a function of how long ago it
 * was verified. Exponential decay with a ~3.5h half-life; never-verified seed data sits at a
 * low baseline so it always wants re-verification before we route anyone there.
 */
export function confidenceFor(resource: Resource, now: number): number {
  if (resource.lastVerifiedAt == null) return 0.35;
  const ageMin = (now - resource.lastVerifiedAt) / 60_000;
  return clamp(Math.exp(-ageMin / 300), 0.2, 1);
}

function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "21:00" -> "9 PM", "08:30" -> "8:30 AM" — for friendly SMS copy. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr} ${period}` : `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

interface IntakeStatus {
  openToday: boolean;
  intakeOpenNow: boolean; // can still show up today and get a bed tonight
  minutesToCutoff: number | null;
  cutoffStr: string | null;
}

// Resources are all in Santa Clara County, so intake hours must be evaluated in Pacific time —
// not the server's clock (Vercel runs UTC). Derive the wall-clock day + minutes in LA.
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function pacificParts(now: Date): { day: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight
  return { day: DAY_INDEX[parts.weekday] ?? now.getDay(), minutes: hour * 60 + parseInt(parts.minute, 10) };
}

/**
 * Whether someone can still get a bed *tonight*. We key off the intake cutoff (the last time
 * you can arrive), not the overnight close time — that's the number that decides routing.
 * Evaluated in Pacific time so it's correct regardless of the server's timezone.
 */
export function intakeStatus(resource: Resource, now: Date): IntakeStatus {
  const { day, minutes: curM } = pacificParts(now);
  const today = resource.hours[day];
  if (!today) return { openToday: false, intakeOpenNow: false, minutesToCutoff: null, cutoffStr: null };
  const cutoffStr = today.intakeCutoff ?? today.close;
  const cutoffM = parseClock(cutoffStr);
  const minutesToCutoff = cutoffM - curM;
  return {
    openToday: true,
    intakeOpenNow: minutesToCutoff >= 0,
    minutesToCutoff: minutesToCutoff >= 0 ? minutesToCutoff : null,
    cutoffStr,
  };
}

/** Gender/family eligibility. Returns null if eligible, or a short reason if not. */
function eligibilityBlock(resource: Resource, c: Constraints): string | null {
  const isFamily = !!(c.family || (c.childrenCount && c.childrenCount > 0));

  if (isFamily && !resource.servesFamilies) return "does not house families";
  if (isFamily && resource.familyCapacity < (c.childrenCount ?? 1)) return "family unit too small";

  switch (resource.genderPolicy) {
    case "men":
      if (c.gender !== "man" || isFamily) return "men only";
      break;
    case "women":
      if (c.gender === "man") return "women only";
      break;
    case "women_children":
      if (c.gender === "man") return "women & children only";
      break;
    case "youth":
      return "youth only"; // we don't capture age; never auto-route adults here
    case "families":
      if (!isFamily) return "families only";
      break;
    case "any":
      break;
  }

  if (c.ada && !resource.adaAccessible) return "not wheelchair accessible";
  if (c.pets && !resource.allowsPets) return "no pets allowed";
  return null;
}

/**
 * Main entry point. Filters to eligible shelters with last-known space, scores them, and
 * returns the ranked list (best first). `now` is injected so the function is pure & testable.
 */
export function rankResources(
  constraints: Constraints,
  resources: Resource[],
  now: Date = new Date(),
  originOverride?: { lat: number; lng: number },
): MatchResult[] {
  const beds = bedsNeededFor(constraints);
  // Prefer the person's real shared/geocoded location; fall back to a ZIP centroid.
  const origin = originOverride ?? centroidForZip(constraints.zip);
  const nowMs = now.getTime();

  const results: MatchResult[] = [];

  for (const r of resources) {
    if (r.type !== "shelter") continue; // bed matching only
    if (eligibilityBlock(r, constraints)) continue; // hard filter
    if (r.openBeds < beds) continue; // no last-known room
    const intake = intakeStatus(r, now);
    if (!intake.openToday) continue; // closed today entirely

    const dist = distanceMiles(origin, { lat: r.lat, lng: r.lng });
    const eta = estimateEtaMin(dist, constraints.noCar);
    const conf = confidenceFor(r, nowMs);

    // --- soft sub-scores, each 0..1 ---
    const proximity = clamp(1 - dist / MAX_USEFUL_MILES, 0, 1);
    const freshness = conf;
    const availability = clamp(0.65 + 0.35 * (r.openBeds / Math.max(r.totalBeds, 1)), 0, 1);

    let reachability: number;
    if (intake.minutesToCutoff != null) {
      reachability =
        eta > intake.minutesToCutoff
          ? 0.1 // cannot make intake — the exact "ghost trip" we exist to prevent
          : 0.5 + 0.5 * (1 - eta / Math.max(intake.minutesToCutoff, 1));
    } else {
      reachability = clamp(1 - eta / 120, 0.3, 1); // intake already passed for tonight
    }

    const score = Math.round(
      100 *
        (WEIGHTS.proximity * proximity +
          WEIGHTS.freshness * freshness +
          WEIGHTS.availability * availability +
          WEIGHTS.reachability * reachability),
    );

    results.push({
      resource: r,
      score,
      confidence: conf,
      distanceMi: Math.round(dist * 10) / 10,
      etaMin: eta,
      openNow: intake.intakeOpenNow,
      minutesToClose: intake.minutesToCutoff,
      reasons: buildReasons(r, constraints, { dist, eta, conf, intake, beds }),
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Nearest resources of a given type to an origin — for the "tonight's plan" suggestions. */
export function nearestByType(
  type: string,
  origin: { lat: number; lng: number },
  resources: Resource[],
  limit = 1,
): { resource: Resource; distanceMi: number }[] {
  return resources
    .filter((r) => r.type === type)
    .map((r) => ({ resource: r, distanceMi: Math.round(distanceMiles(origin, { lat: r.lat, lng: r.lng }) * 10) / 10 }))
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, limit);
}

function buildReasons(
  r: Resource,
  c: Constraints,
  ctx: {
    dist: number;
    eta: number;
    conf: number;
    intake: IntakeStatus;
    beds: number;
  },
): string[] {
  const reasons: string[] = [];
  const isFamily = !!(c.family || (c.childrenCount && c.childrenCount > 0));

  if (isFamily) reasons.push(`Family space for ${ctx.beds}`);
  if (c.ada && r.adaAccessible) reasons.push("ADA-accessible");
  if (c.pets && r.allowsPets) reasons.push("Pets welcome");

  reasons.push(`${ctx.dist.toFixed(1)} mi · ~${ctx.eta} min by ${c.noCar ? "transit" : "car"}`);

  if (ctx.conf >= 0.85) reasons.push("Recently verified");
  else if (r.lastVerifiedAt == null) reasons.push("Last-known availability — needs verification");
  else reasons.push("Availability aging — re-verifying");

  if (ctx.intake.cutoffStr) {
    const cutoff = formatClock(ctx.intake.cutoffStr);
    if (ctx.intake.minutesToCutoff != null && ctx.eta > ctx.intake.minutesToCutoff) {
      reasons.push(`⚠ may not reach intake by ${cutoff}`);
    } else {
      reasons.push(`Intake closes ${cutoff}`);
    }
  }
  return reasons;
}
