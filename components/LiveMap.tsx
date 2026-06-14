"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

export interface MapResource {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  confidence: number;
  openBeds: number;
  totalBeds: number;
}
export interface MapPerson {
  id: string;
  pseudonym: string;
  status: string;
  topMatchId: string | null;
  coords: { lat: number; lng: number } | null;
}

// Theme hex (Leaflet SVG paths don't resolve CSS vars reliably).
const C = {
  confirmed: "#35d6a4",
  stale: "#fbbf24",
  full: "#f8716f",
  faint: "#5a6688",
  aurora: "#4fd1c5",
  sky: "#38bdf8",
  north: "#f7c95a",
  violet: "#a78bfa",
};

function shelterColor(r: MapResource): string {
  if (r.openBeds === 0) return C.full;
  if (r.confidence >= 85) return C.confirmed;
  if (r.confidence >= 50) return C.stale;
  return C.faint;
}
function personColor(status: string): string {
  return (
    { intake: C.sky, matching: C.stale, verifying: C.north, routed: C.confirmed, crisis: C.violet }[
      status
    ] ?? C.aurora
  );
}

export function LiveMap({ resources, people }: { resources: MapResource[]; people: MapPerson[] }) {
  const shelters = resources.filter((r) => r.type === "shelter");
  const located = people.filter((p) => p.coords);

  return (
    <MapContainer
      center={[37.355, -121.92]}
      zoom={11}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "#080d1c" }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />

      {/* in-progress routes: routed person -> matched shelter */}
      {located.map((p) => {
        if (p.status !== "routed" || !p.topMatchId) return null;
        const r = shelters.find((s) => s.id === p.topMatchId);
        if (!r) return null;
        return (
          <Polyline
            key={`route-${p.id}`}
            positions={[[p.coords!.lat, p.coords!.lng], [r.lat, r.lng]]}
            pathOptions={{ color: C.confirmed, weight: 2, dashArray: "4 6", opacity: 0.8 }}
          />
        );
      })}

      {/* shelters */}
      {shelters.map((r) => {
        const color = shelterColor(r);
        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={7}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }}
          >
            <Tooltip>
              <strong>{r.name}</strong>
              <br />
              {r.openBeds}/{r.totalBeds} beds · {r.confidence}% fresh
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* people */}
      {located.map((p) => {
        const color = personColor(p.status);
        return (
          <CircleMarker
            key={p.id}
            center={[p.coords!.lat, p.coords!.lng]}
            radius={6}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}
          >
            <Tooltip>
              <strong>{p.pseudonym}</strong>
              <br />
              {p.status}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
