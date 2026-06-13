// Lightweight geo helpers. No external geocoding service — for a county-scoped tool we
// only need approximate ZIP centroids + straight-line distance + a transit/drive ETA model.
// Deliberately transparent so it can be explained line-by-line in code review.

interface LatLng {
  lat: number;
  lng: number;
}

// Approximate centroids for the ZIPs Polaris serves (Santa Clara County core).
// Good enough for ranking by proximity; we are not doing turn-by-turn routing.
const ZIP_CENTROIDS: Record<string, LatLng> = {
  "95035": { lat: 37.4337, lng: -121.8949 }, // Milpitas
  "95131": { lat: 37.3861, lng: -121.8917 }, // San Jose – Berryessa
  "95112": { lat: 37.3522, lng: -121.8847 }, // San Jose – North/Downtown
  "95116": { lat: 37.349, lng: -121.857 }, // San Jose – East
  "95110": { lat: 37.337, lng: -121.9 }, // San Jose – Downtown
  "95113": { lat: 37.3337, lng: -121.8907 }, // San Jose – City Center
  "95050": { lat: 37.3489, lng: -121.9555 }, // Santa Clara
  "94089": { lat: 37.409, lng: -122.001 }, // Sunnyvale
  "94303": { lat: 37.4636, lng: -122.1444 }, // East Palo Alto
};

const DEFAULT_CENTROID = ZIP_CENTROIDS["95035"]; // Milpitas, the demo origin

export function centroidForZip(zip: string | undefined): LatLng {
  if (zip && ZIP_CENTROIDS[zip]) return ZIP_CENTROIDS[zip];
  return DEFAULT_CENTROID;
}

/** Haversine great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough travel time in minutes. Someone with no car is on transit/foot, which is
 * dramatically slower and is the difference between "reachable before intake closes" and not.
 * That asymmetry is exactly what we want the matcher to weigh.
 */
export function estimateEtaMin(distanceMi: number, noCar: boolean | undefined): number {
  if (noCar) {
    const TRANSIT_MPH = 14; // buses incl. stops/transfers, effective
    const WAIT_MIN = 9; // typical wait for the next bus
    return Math.round(WAIT_MIN + (distanceMi / TRANSIT_MPH) * 60);
  }
  const DRIVE_MPH = 24; // urban driving
  return Math.round((distanceMi / DRIVE_MPH) * 60);
}
