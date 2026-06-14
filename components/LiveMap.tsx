"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMapEvents } from "react-leaflet";

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
export type Selected =
  | { kind: "resource"; id: string }
  | { kind: "person"; id: string }
  | null;

// Restrained ops palette.
const COLOR = {
  accent: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  route: "#3B82F6",
};

function shelterBorder(r: MapResource): string {
  if (r.openBeds === 0) return COLOR.error;
  if (r.confidence >= 85) return COLOR.success;
  if (r.confidence >= 50) return COLOR.warning;
  return COLOR.accent;
}
function personFill(status: string): string {
  return (
    { intake: COLOR.accent, matching: COLOR.warning, verifying: COLOR.warning, routed: COLOR.success, crisis: COLOR.error }[
      status
    ] ?? COLOR.success
  );
}

function shelterIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18],
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.18)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/></svg></div>`,
  });
}
function userIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -14],
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></div>`,
  });
}

function BackgroundClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: () => onClear() });
  return null;
}

export function LiveMap({
  resources,
  people,
  onSelect,
}: {
  resources: MapResource[];
  people: MapPerson[];
  onSelect?: (s: Selected) => void;
}) {
  const shelters = resources.filter((r) => r.type === "shelter");
  const located = people.filter((p) => p.coords);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const tileUrl = token
    ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={[37.355, -121.92]}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#F6F7F8" }}
      attributionControl={false}
    >
      <TileLayer url={tileUrl} tileSize={token ? 512 : 256} zoomOffset={token ? -1 : 0} />
      <ZoomControl position="bottomright" />
      {onSelect && <BackgroundClick onClear={() => onSelect(null)} />}

      {/* in-progress routes */}
      {located.map((p) => {
        if (p.status !== "routed" || !p.topMatchId) return null;
        const r = shelters.find((s) => s.id === p.topMatchId);
        if (!r) return null;
        return (
          <Polyline
            key={`route-${p.id}`}
            positions={[[p.coords!.lat, p.coords!.lng], [r.lat, r.lng]]}
            pathOptions={{ color: COLOR.success, weight: 3, lineCap: "round", lineJoin: "round", opacity: 0.85 }}
          />
        );
      })}

      {/* shelters */}
      {shelters.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={shelterIcon(shelterBorder(r))}
          eventHandlers={onSelect ? { click: () => onSelect({ kind: "resource", id: r.id }) } : undefined}
        >
          <Tooltip>
            <strong>{r.name}</strong>
            <br />
            {r.openBeds}/{r.totalBeds} beds · {r.confidence}% fresh
          </Tooltip>
        </Marker>
      ))}

      {/* people */}
      {located.map((p) => (
        <Marker
          key={p.id}
          position={[p.coords!.lat, p.coords!.lng]}
          icon={userIcon(personFill(p.status))}
          eventHandlers={onSelect ? { click: () => onSelect({ kind: "person", id: p.id }) } : undefined}
        >
          <Tooltip>
            <strong>{p.pseudonym}</strong>
            <br />
            {p.status}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
