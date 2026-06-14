import { randomBytes } from "crypto";
import type { Conversation, Resource, Verification } from "./types";
import { baseUrl, placeCall, sendSms } from "./sms";
import {
  addVerification,
  bumpImpact,
  getResource,
  getResources,
  getVerification,
  updateResource,
  updateVerification,
  upsertConversation,
  getConversation,
} from "./store";
import { bedsNeededFor, nearestByType, rankResources } from "./matcher";
import { confirmedHeader, directionsReply, fullFallback, planExtras, routeReply } from "./ai";
import { getDirections, mapboxConfigured } from "./directions";

/**
 * The Ghost Bed Radar engine + route composition.
 *
 * A "ghost bed" is a listing that says open but is actually full. Polaris refuses to route
 * someone to an unverified bed: it places a real outbound call to the provider, which answers
 * one keypad question (1 = space, 2 = full). DTMF — reliable live. On confirm, with the
 * person's location we send real street directions, a route map image, and a nearby plan.
 */

let counter = 0;
function vid(): string {
  counter += 1;
  return `v${Date.now().toString(36)}${counter}`;
}

export interface RouteMessage {
  text: string;
  mediaUrl?: string;
  routePolyline?: string;
  mapToken?: string;
  mapTokenExp?: number;
}

/**
 * Build the message we send once a bed is secured. With a precise location we attach real
 * driving directions, a map image (token-gated), and the nearest food + showers as a plan.
 */
export async function composeRoute(
  conv: Conversation,
  resource: Resource,
  lang: "en" | "es",
  opts: { justConfirmedSeconds?: number; verifiedMinutesAgo?: number } = {},
): Promise<RouteMessage> {
  const resources = await getResources();
  const match = rankResources(conv.constraints, resources, new Date(), conv.location).find(
    (m) => m.resource.id === resource.id,
  );

  if (conv.location && mapboxConfigured()) {
    const dir = await getDirections(conv.location, { lat: resource.lat, lng: resource.lng });
    if (dir) {
      const food = [
        ...nearestByType("food", conv.location, resources, 1),
        ...nearestByType("grocery", conv.location, resources, 1),
      ].sort((a, b) => a.distanceMi - b.distanceMi)[0];
      const shower = [
        ...nearestByType("shower", conv.location, resources, 1),
        ...nearestByType("drop_in", conv.location, resources, 1),
      ].sort((a, b) => a.distanceMi - b.distanceMi)[0];
      const extras = planExtras(
        [
          food && { icon: "🍽", name: food.resource.name, distanceMi: food.distanceMi },
          shower && { icon: "🚿", name: shower.resource.name, distanceMi: shower.distanceMi },
        ].filter(Boolean) as { icon: string; name: string; distanceMi: number }[],
        lang,
      );
      const header = match
        ? confirmedHeader(match, conv.constraints, lang, opts)
        : lang === "es" ? `✅ ${resource.name} confirmado.` : `✅ ${resource.name} confirmed.`;
      const callLine = lang === "es" ? "\n\nResponde LLAMAR para conectar." : "\n\nReply CALL to connect.";
      const token = randomBytes(24).toString("base64url");
      return {
        text: header + "\n\n" + directionsReply(resource.name, dir, lang) + extras + callLine,
        mediaUrl: `${baseUrl()}/api/map?t=${token}`,
        routePolyline: dir.polyline,
        mapToken: token,
        mapTokenExp: Date.now() + 10 * 60_000,
      };
    }
  }

  // Fallback: no location / no Mapbox — the confirmation-style route reply.
  return { text: match ? routeReply(match, conv.constraints, lang, opts) : `✅ ${resource.name} — head there now.` };
}

/** Kick off a verification call for the chosen resource on behalf of a conversation. */
export async function beginVerification(resource: Resource, conversation: Conversation): Promise<Verification> {
  const beds = bedsNeededFor(conversation.constraints);
  const verification: Verification = {
    id: vid(),
    resourceId: resource.id,
    resourceName: resource.name,
    conversationId: conversation.id,
    status: "calling",
    bedsNeeded: beds,
    requestedAt: Date.now(),
    respondedAt: null,
    openBedsReported: null,
  };
  await addVerification(verification);

  const target = process.env.DEMO_SHELTER_PHONE || resource.phone;
  await placeCall(target, `${baseUrl()}/api/verify/call?vid=${verification.id}`);
  return verification;
}

/**
 * Handle the provider's keypad response (or a timeout). Updates state and texts the user the
 * outcome (with map + directions on confirm). Returns the outbound text or null.
 */
export async function resolveVerification(verificationId: string, digit: string | null): Promise<string | null> {
  const v = await getVerification(verificationId);
  if (!v || v.status !== "calling") return null;

  const resource = await getResource(v.resourceId);
  const conversation = await getConversation(v.conversationId);
  if (!resource || !conversation) return null;
  const now = Date.now();

  if (digit === "1") {
    await updateResource(resource.id, {
      lastVerifiedAt: now,
      verifyMethod: "phone",
      openBeds: Math.max(resource.openBeds, v.bedsNeeded),
    });
    await updateVerification(v.id, { status: "confirmed", respondedAt: now, openBedsReported: resource.openBeds });
    await bumpImpact({ verifiedRoutes: 1 });

    const secs = Math.max(1, Math.round((now - v.requestedAt) / 1000));
    const fresh = (await getResource(resource.id)) ?? resource;
    const rm = await composeRoute(conversation, fresh, conversation.lang, { justConfirmedSeconds: secs });
    await upsertConversation({
      ...conversation,
      status: "routed",
      routePolyline: rm.routePolyline,
      mapToken: rm.mapToken,
      mapTokenExp: rm.mapTokenExp,
      lastReplies: [rm.text],
      updatedAt: now,
    });
    await sendSms(conversation.id, rm.text, rm.mediaUrl);
    return rm.text;
  }

  if (digit === "2") {
    await updateResource(resource.id, { lastVerifiedAt: now, verifyMethod: "phone", openBeds: 0 });
    await updateVerification(v.id, { status: "full", respondedAt: now, openBedsReported: 0 });
    await bumpImpact({ ghostBedsAvoided: 1 });
    const next = rankResources(conversation.constraints, await getResources(), new Date(), conversation.location).find(
      (m) => m.resource.id !== resource.id,
    );
    const body = fullFallback(next?.resource.name ?? null, conversation.lang);
    await upsertConversation({ ...conversation, status: "matching", lastReplies: [body], updatedAt: now });
    await sendSms(conversation.id, body);
    return body;
  }

  await updateVerification(v.id, { status: "no_answer", respondedAt: now });
  const body =
    conversation.lang === "es"
      ? `No contestaron en ${resource.name}. No te mando sin confirmar. Sigo intentando con otra opción.`
      : `No answer at ${resource.name}. I won't send you without confirming — let me try another option.`;
  await upsertConversation({ ...conversation, status: "matching", lastReplies: [body], updatedAt: now });
  await sendSms(conversation.id, body);
  return body;
}
