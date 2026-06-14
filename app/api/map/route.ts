import { getConversationByMapToken, getResource } from "@/lib/store";
import { fetchStaticMap, getDirections } from "@/lib/directions";

// Returns a PNG of the real-street route from a person's shared location to their matched
// shelter. Addressed by an unguessable, short-lived token (NOT the phone number) so a person's
// location can't be enumerated — the token is minted server-side when directions are generated.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const conv = await getConversationByMapToken(token);
  if (!conv?.location || !conv.topMatchId) return new Response("not found", { status: 404 });

  const r = await getResource(conv.topMatchId);
  if (!r) return new Response("not found", { status: 404 });

  const dir = await getDirections(conv.location, { lat: r.lat, lng: r.lng });
  if (!dir) return new Response("no directions", { status: 502 });

  const png = await fetchStaticMap(dir.polyline, conv.location, { lat: r.lat, lng: r.lng });
  if (!png) return new Response("no map", { status: 502 });

  return new Response(png, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=120" },
  });
}
