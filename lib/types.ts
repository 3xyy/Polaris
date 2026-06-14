// Core domain types for Polaris.
// Polaris is a verification layer over housing resources: it ranks options for a
// person in need, then confirms availability by phone BEFORE sending them across town.

export type ResourceType = "shelter" | "food" | "shower" | "clinic" | "drop_in";

/**
 * Who a resource can serve. Matching is strict on these — sending a family to a
 * men-only shelter is worse than sending them nowhere.
 */
export type GenderPolicy =
  | "any"
  | "women"
  | "men"
  | "women_children" // women and accompanied children
  | "families"
  | "youth";

/** Open/close in 24h "HH:MM". intakeCutoff is the last time someone can show up and still get a bed. */
export interface DayHours {
  open: string;
  close: string;
  intakeCutoff?: string;
}

/** Keyed by day of week, 0 = Sunday … 6 = Saturday. null = closed that day. */
export type Hours = Record<number, DayHours | null>;

/** How a resource's availability was last confirmed. Drives the trust/confidence score. */
export type VerifyMethod = "phone" | "self" | "crowd" | "seed";

/** Live verification lifecycle, surfaced on the Ghost Bed Radar. */
export type VerificationStatus =
  | "scanning" // matcher is selecting a candidate
  | "calling" // outbound call placed, awaiting the shelter
  | "confirmed" // shelter confirmed space
  | "full" // shelter said no space
  | "no_answer" // call timed out / went unanswered
  | "stale" // never (re)verified, falling back to last-known
  | "ineligible"; // candidate filtered out before calling

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  /** Intake line Polaris would call to verify. In demos this is overridden by DEMO_SHELTER_PHONE. */
  phone: string;
  hours: Hours;

  // ---- Eligibility capabilities (hard constraints) ----
  servesFamilies: boolean;
  familyCapacity: number; // beds reservable for a single family unit
  genderPolicy: GenderPolicy;
  adaAccessible: boolean;
  allowsPets: boolean;
  sobrietyRequired: boolean;

  // ---- Live availability (mutable; updated by verify calls + provider beacons) ----
  totalBeds: number;
  openBeds: number;
  lastVerifiedAt: number | null; // epoch ms; null = never verified this session
  verifyMethod: VerifyMethod;

  notes?: string;
}

/** Structured needs extracted from a free-text message, accreted across a conversation. */
export interface Constraints {
  zip?: string;
  urgency?: "tonight" | "soon" | "flexible";
  family?: boolean;
  childrenCount?: number;
  bedsNeeded?: number;
  gender?: "woman" | "man" | "nonbinary";
  ada?: boolean;
  pets?: boolean;
  noCar?: boolean;
}

/** A scored, explained match. `reasons` is what makes the ranking defensible & human-readable. */
export interface MatchResult {
  resource: Resource;
  score: number; // Polaris Score, 0–100
  confidence: number; // 0–1 freshness/trust in the availability figure
  distanceMi: number;
  etaMin: number | null;
  openNow: boolean;
  minutesToClose: number | null;
  reasons: string[];
}

/** A single verification attempt — powers the Ghost Bed Radar and the impact counters. */
export interface Verification {
  id: string;
  resourceId: string;
  resourceName: string;
  conversationId: string;
  status: VerificationStatus;
  bedsNeeded: number;
  requestedAt: number;
  respondedAt: number | null;
  openBedsReported: number | null;
}

/** A live conversation thread, keyed by phone number. Powers the Incoming Signals feed. */
export interface Conversation {
  id: string; // phone (E.164) or session id
  pseudonym: string; // friendly handle shown on the dashboard (no PII)
  channel: "sms" | "voice";
  lang: "en" | "es";
  location?: { lat: number; lng: number }; // set when the user shares a precise location
  constraints: Constraints;
  lastMessage: string;
  lastReplies: string[];
  topMatchId: string | null;
  status: "intake" | "matching" | "verifying" | "routed" | "crisis";
  createdAt: number;
  updatedAt: number;
}

export interface ImpactCounters {
  ghostBedsAvoided: number; // candidates that turned out full/no-answer before we sent anyone
  verifiedRoutes: number; // confirmed placements
  providerUpdates: number; // beacon updates received
}
