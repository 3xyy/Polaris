import { getConversation, getResource } from "@/lib/store";
import { fetchStaticMap, getDirections } from "@/lib/directions";

// Returns a PNG of the real-street route from a person's shared location to their matched
// shelter. Used as the WhatsApp/MMS <Media> source so the Mapbox token never leaves the server.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cid = new URL(req.url).searchParams.get("cid") ?? "";
  const conv = await getConversation(cid);
  if (!conv?.location || !conv.topMatchId) return new Response("no route", { status: 404 });

  const r = await getResource(conv.topMatchId);
  if (!r) return new Response("no resource", { status: 404 });

  const dir = await getDirections(conv.location, { lat: r.lat, lng: r.lng });
  if (!dir) return new Response("no directions", { status: 502 });

  const png = await fetchStaticMap(dir.polyline, conv.location, { lat: r.lat, lng: r.lng });
  if (!png) return new Response("no map", { status: 502 });

  return new Response(png, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=120" },
  });
}
