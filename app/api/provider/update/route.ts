import { bumpImpact, getResource, updateResource } from "@/lib/store";
import type { Resource } from "@/lib/types";

// Provider Beacon: a shelter reports its own availability in plain text ("FULL", "3 OPEN",
// "FAMILY ROOM OPEN UNTIL 9PM"). We parse it, freshen the resource, and the dashboard reflects
// it within one poll. Keeps data current with zero scraping.

export const dynamic = "force-dynamic";

function applyUpdate(resource: Resource, raw: string): Partial<Resource> {
  const text = raw.trim().toLowerCase();
  const now = Date.now();
  const patch: Partial<Resource> = { lastVerifiedAt: now, verifyMethod: "self" };

  if (/\bfull\b|no (space|beds|room)/.test(text)) {
    patch.openBeds = 0;
    return patch;
  }
  const openMatch = text.match(/(\d+)\s*(open|beds?|available)/);
  if (openMatch) {
    patch.openBeds = Math.min(parseInt(openMatch[1], 10), resource.totalBeds || 999);
    return patch;
  }
  if (/family room|family bed|family unit/.test(text)) {
    patch.servesFamilies = true;
    patch.openBeds = Math.max(resource.openBeds, resource.familyCapacity || 2);
    return patch;
  }
  // Unrecognized — at least record that they checked in.
  return patch;
}

export async function POST(req: Request) {
  const { resourceId, update } = (await req.json()) as {
    resourceId?: string;
    update?: string;
  };
  if (!resourceId || !update) {
    return new Response("Missing resourceId/update", { status: 400 });
  }
  const resource = await getResource(resourceId);
  if (!resource) return new Response("Unknown resource", { status: 404 });

  const patch = applyUpdate(resource, update);
  const updated = await updateResource(resourceId, patch);
  await bumpImpact({ providerUpdates: 1 });

  return Response.json({ ok: true, resource: updated });
}
