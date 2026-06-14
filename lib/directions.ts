// Mapbox routing + static map imagery. Real street-following routes (Directions API) drawn
// onto a Static Images PNG, plus turn-by-turn steps. Token stays server-side.

const TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function mapboxConfigured(): boolean {
  return Boolean(TOKEN);
}

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Step {
  instruction: string;
  distanceFt: number;
}
export interface Directions {
  polyline: string; // encoded polyline5 of the route geometry
  steps: Step[];
  distanceMi: number;
  durationMin: number;
}

/** Real street route origin -> destination. Returns null if Mapbox isn't configured or fails. */
export async function getDirections(origin: LatLng, dest: LatLng): Promise<Directions | null> {
  if (!TOKEN) return null;
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?access_token=${TOKEN}&overview=simplified&geometries=polyline&steps=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { geometry: string; distance: number; duration: number; legs: { steps: { maneuver: { instruction: string }; distance: number }[] }[] }[];
    };
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      polyline: route.geometry,
      distanceMi: Math.round((route.distance / 1609.34) * 10) / 10,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      steps: (route.legs[0]?.steps ?? []).map((s) => ({
        instruction: s.maneuver.instruction,
        distanceFt: Math.round(s.distance * 3.28084),
      })),
    };
  } catch {
    return null;
  }
}

/** Geocode free text (a cross-street / address) to a coordinate, biased near `near`. */
export async function geocode(text: string, near?: LatLng): Promise<LatLng | null> {
  if (!TOKEN) return null;
  const prox = near ? `&proximity=${near.lng},${near.lat}` : "";
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
    `?access_token=${TOKEN}&country=US&limit=1${prox}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { center: [number, number] }[] };
    const c = data.features?.[0]?.center;
    return c ? { lat: c[1], lng: c[0] } : null;
  } catch {
    return null;
  }
}

/** Mapbox Static Images URL with the route drawn + start/end pins. Fitted to the route. */
export function staticMapUrl(polyline: string, origin: LatLng, dest: LatLng): string {
  const path = `path-5+2563eb-0.9(${encodeURIComponent(polyline)})`;
  const start = `pin-s+10b981(${origin.lng},${origin.lat})`;
  const end = `pin-l+ef4444(${dest.lng},${dest.lat})`;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `${path},${start},${end}/auto/640x420@2x?padding=48&access_token=${TOKEN}`
  );
}

/** Fetch the static map PNG bytes (so we never expose the token in the MMS/WhatsApp media URL). */
export async function fetchStaticMap(polyline: string, origin: LatLng, dest: LatLng): Promise<ArrayBuffer | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(staticMapUrl(polyline, origin, dest));
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
