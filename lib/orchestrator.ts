import type { Constraints, Conversation } from "./types";
import { extractConstraints, isCrisis, mergeConstraints } from "./constraints";
import { backboardEnabled, enrichConstraints } from "./backboard";
import { geocode, mapboxConfigured } from "./directions";
import { nearestByType, rankResources } from "./matcher";
import { bumpImpact, getConversation, getResource, getResources, upsertConversation } from "./store";
import { beginVerification, composeRoute } from "./verify";
import {
  askLocation,
  callAhead,
  crisisReply,
  detectLang,
  helpReply,
  locationAck,
  nearbyList,
  noMatch,
  verifying,
} from "./ai";

/**
 * The conversation state machine — the part Polaris owns end-to-end. It decides when to ask
 * for a location, when a candidate is too stale to trust (→ a real phone call), and when to
 * route with directions. The AI layer only renders language; the routing logic lives here.
 *
 * Location-first: we never ask for a ZIP — we ask the person to share their location (or type
 * an address / cross-street, which we geocode), then route from their real position.
 */

const VERIFY_THRESHOLD = 0.7; // below this confidence we re-confirm by phone before routing
const COUNTY = { lat: 37.355, lng: -121.92 }; // bias geocoding to Santa Clara County

const STAR_NAMES = [
  "Vega", "Lyra", "Orion", "Mira", "Rigel", "Atlas", "Nova", "Caelum",
  "Sirius", "Polaris", "Altair", "Carina", "Phoenix", "Cassia", "Leo",
];
function pseudonymFor(phone: string): string {
  let h = 0;
  for (const ch of phone) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return `${STAR_NAMES[h % STAR_NAMES.length]}-${(h % 900) + 100}`;
}

export interface InboundResult {
  replies: string[];
  conversation: Conversation;
  verificationStarted: boolean;
  verificationId?: string;
  mediaUrl?: string;
}

function hasNeed(c: Constraints): boolean {
  return Boolean(c.urgency || c.family || c.childrenCount || c.gender || c.ada || c.pets);
}
function newConv(from: string, channel: "sms" | "voice", lang: "en" | "es", body: string): Conversation {
  const now = Date.now();
  return {
    id: from, pseudonym: pseudonymFor(from), channel, lang, constraints: {},
    lastMessage: body, lastReplies: [], topMatchId: null, status: "intake", createdAt: now, updatedAt: now,
  };
}

export async function handleInbound(args: { from: string; body: string; channel?: "sms" | "voice" }): Promise<InboundResult> {
  const { from, body, channel = "sms" } = args;
  const lang = detectLang(body);
  let conv = await getConversation(from);
  if (!conv) conv = newConv(from, channel, lang, body);
  conv = { ...conv, lang, lastMessage: body, updatedAt: Date.now() };

  // 1) Safety first.
  if (isCrisis(body)) return done(conv, "crisis", crisisReply(lang));

  // 2) Commands.
  const cmd = body.trim().toUpperCase();
  if (["HELP", "AYUDA", "INFO"].includes(cmd)) return done(conv, conv.status, helpReply(lang));
  if ((cmd === "CALL" || cmd === "LLAMAR") && conv.topMatchId) {
    const r = await getResource(conv.topMatchId);
    if (r) return done(conv, "routed", callAhead(r.name, r.phone, conv.constraints, lang));
  }
  if (["FOOD", "COMIDA"].includes(cmd)) return nearby(conv, ["food", "grocery"], lang === "es" ? "Comida gratis" : "Free food");
  if (["SHOWER", "SHOWERS", "DUCHA", "DUCHAS"].includes(cmd)) return nearby(conv, ["shower", "drop_in"], lang === "es" ? "Duchas" : "Showers");
  if (["YES", "SI", "SÍ"].includes(cmd)) {
    const top = rankResources(conv.constraints, await getResources(), new Date(), conv.location)[0];
    if (top) {
      conv = { ...conv, topMatchId: top.resource.id };
      const v = await beginVerification(top.resource, conv);
      return { ...(await done(conv, "verifying", verifying(top.resource.name, lang))), verificationStarted: true, verificationId: v.id };
    }
  }

  // 3) Understand the need (deterministic first; Backboard fills thin gaps).
  const extracted = extractConstraints(body);
  let merged = mergeConstraints(conv.constraints, extracted);
  const thin = !extracted.family && extracted.childrenCount == null && !extracted.gender && !extracted.ada && !extracted.pets;
  if (backboardEnabled() && thin) {
    const llm = await enrichConstraints(body);
    if (llm) merged = mergeConstraints(llm, merged);
  }
  conv = { ...conv, constraints: merged };

  // 4) Location-first routing.
  if (conv.location) return matchAndRoute(conv);

  // No location yet: if we already asked, treat this text as an address to geocode.
  if (conv.status === "locating") {
    const loc = mapboxConfigured() ? await geocode(body, COUNTY) : null;
    if (loc) {
      conv = { ...conv, location: loc };
      return matchAndRoute(conv);
    }
    return done(conv, "locating", lang === "es"
      ? "No encontré esa dirección. Comparte tu ubicación 📍 (toca 📎 → Ubicación) o escribe un cruce de calles."
      : "I couldn't find that address. Share your location 📍 (tap 📎 → Location) or type a nearby cross-street.");
  }

  // First time: ask for location.
  return done(conv, "locating", askLocation(conv.constraints, lang));
}

/**
 * A shared precise location (WhatsApp native share, or a geocoded address). If we already know
 * what the person needs, route immediately; otherwise ask what they need.
 */
export async function handleLocation(args: { from: string; lat: number; lng: number; channel?: "sms" | "voice" }): Promise<InboundResult> {
  const { from, lat, lng, channel = "sms" } = args;
  let conv = await getConversation(from);
  if (!conv) conv = newConv(from, channel, "en", "📍 shared location");
  conv = { ...conv, location: { lat, lng }, lastMessage: "📍 shared location", updatedAt: Date.now() };

  if (hasNeed(conv.constraints) || conv.topMatchId) return matchAndRoute(conv);
  return done(conv, "intake", locationAck(conv.lang));
}

/** Rank from the person's real location, then verify-if-stale or route with directions. */
async function matchAndRoute(conv: Conversation): Promise<InboundResult> {
  const lang = conv.lang;
  const resources = await getResources();
  const ranked = rankResources(conv.constraints, resources, new Date(), conv.location);
  if (ranked.length === 0) return done(conv, "routed", noMatch(lang));

  const top = ranked[0];
  conv = { ...conv, topMatchId: top.resource.id };

  if (top.confidence < VERIFY_THRESHOLD) {
    const v = await beginVerification(top.resource, conv);
    return { ...(await done(conv, "verifying", verifying(top.resource.name, lang))), verificationStarted: true, verificationId: v.id };
  }

  // Already fresh — route now with directions + map + nearby plan.
  const minutesAgo = top.resource.lastVerifiedAt ? Math.max(1, Math.round((Date.now() - top.resource.lastVerifiedAt) / 60_000)) : 0;
  const rm = await composeRoute(conv, top.resource, lang, { verifiedMinutesAgo: minutesAgo });
  conv = { ...conv, routePolyline: rm.routePolyline, mapToken: rm.mapToken, mapTokenExp: rm.mapTokenExp };
  await bumpImpact({ verifiedRoutes: 1 });
  return { ...(await done(conv, "routed", rm.text)), mediaUrl: rm.mediaUrl };
}

/** FOOD / SHOWER style lookups: nearest services of given types from the person's location. */
async function nearby(conv: Conversation, types: string[], label: string): Promise<InboundResult> {
  if (!conv.location) return done(conv, "locating", askLocation(conv.constraints, conv.lang));
  const resources = await getResources();
  const items = types
    .flatMap((t) => nearestByType(t, conv.location!, resources, 2))
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, 3)
    .map((x) => ({ name: x.resource.name, distanceMi: x.distanceMi, address: `${x.resource.address}, ${x.resource.city}` }));
  return done(conv, conv.status, nearbyList(label, items, conv.lang));
}

/** Persist the conversation with one reply and return a plain InboundResult. */
async function done(conv: Conversation, status: Conversation["status"], reply: string): Promise<InboundResult> {
  const updated = { ...conv, status, lastReplies: [reply], updatedAt: Date.now() };
  await upsertConversation(updated);
  return { replies: [reply], conversation: updated, verificationStarted: false };
}
