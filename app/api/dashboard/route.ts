import { confidenceFor } from "@/lib/matcher";
import { centroidForZip } from "@/lib/geo";
import {
  getImpact,
  getResources,
  listConversations,
  listVerifications,
} from "@/lib/store";

// Single read endpoint the Live Sky dashboard polls (every ~2s). Returns everything the
// mission-control view renders, with freshness/confidence computed server-side against `now`,
// plus coordinates so the live map can plot shelters and people.

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const [resources, conversations, verifications, impact] = await Promise.all([
    getResources(),
    listConversations(12),
    listVerifications(12),
    getImpact(),
  ]);

  const resourceViews = resources.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    city: r.city,
    zip: r.zip,
    lat: r.lat,
    lng: r.lng,
    openBeds: r.openBeds,
    totalBeds: r.totalBeds,
    genderPolicy: r.genderPolicy,
    adaAccessible: r.adaAccessible,
    allowsPets: r.allowsPets,
    servesFamilies: r.servesFamilies,
    verifyMethod: r.verifyMethod,
    lastVerifiedAt: r.lastVerifiedAt,
    confidence: Math.round(confidenceFor(r, now) * 100),
  }));

  // Attach a plottable position to each conversation: exact shared location if we have it,
  // otherwise the centroid of their ZIP. People with neither are left without coords.
  const conversationViews = conversations.map((c) => {
    const coords = c.location ?? (c.constraints.zip ? centroidForZip(c.constraints.zip) : null);
    return {
      id: c.id,
      pseudonym: c.pseudonym,
      lang: c.lang,
      constraints: c.constraints,
      lastMessage: c.lastMessage,
      status: c.status,
      topMatchId: c.topMatchId,
      routePolyline: c.routePolyline ?? null,
      updatedAt: c.updatedAt,
      coords,
    };
  });

  return Response.json({
    now,
    impact,
    conversations: conversationViews,
    verifications,
    resources: resourceViews,
  });
}
