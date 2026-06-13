import { confidenceFor } from "@/lib/matcher";
import {
  getImpact,
  getResources,
  listConversations,
  listVerifications,
} from "@/lib/store";

// Single read endpoint the Live Sky dashboard polls (every ~2s). Returns everything the
// mission-control view renders, with freshness/confidence computed server-side against `now`.

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

  return Response.json({
    now,
    impact,
    conversations,
    verifications,
    resources: resourceViews,
  });
}
