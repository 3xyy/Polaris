"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Selected } from "@/components/LiveMap";

// Leaflet touches `window`, so load the map client-only.
const LiveMap = dynamic(() => import("@/components/LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#F6F7F8] text-[13px] text-[#9CA3AF]">Loading map…</div>,
});

// ---- shapes returned by /api/dashboard ----
interface Constraints {
  zip?: string; urgency?: string; family?: boolean; childrenCount?: number;
  gender?: string; ada?: boolean; pets?: boolean; noCar?: boolean;
}
interface Conversation {
  id: string; pseudonym: string; lang: string; constraints: Constraints;
  lastMessage: string; status: string; topMatchId: string | null;
  coords: { lat: number; lng: number } | null; updatedAt: number;
}
interface Verification {
  id: string; resourceName: string; status: string; bedsNeeded: number;
  requestedAt: number; respondedAt: number | null;
}
interface ResourceView {
  id: string; name: string; type: string; city: string; lat: number; lng: number;
  openBeds: number; totalBeds: number; genderPolicy: string; adaAccessible: boolean;
  allowsPets: boolean; servesFamilies: boolean; verifyMethod: string;
  lastVerifiedAt: number | null; confidence: number;
}
interface Data {
  now: number;
  impact: { ghostBedsAvoided: number; verifiedRoutes: number; providerUpdates: number };
  conversations: Conversation[];
  verifications: Verification[];
  resources: ResourceView[];
}

const ACCENT = "#2563EB", SUCCESS = "#10B981", WARNING = "#F59E0B", ERROR = "#EF4444";

function ago(ts: number | null, now: number): string {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
function bandColor(score: number): string {
  return score >= 85 ? SUCCESS : score >= 50 ? WARNING : ERROR;
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [clock, setClock] = useState("");
  const [selected, setSelected] = useState<Selected>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      setData(await res.json());
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  const reset = async () => {
    await fetch("/api/reset", { method: "POST" });
    setSelected(null);
    load();
  };

  const now = data?.now ?? Date.now();
  const resources = data?.resources ?? [];
  const conversations = data?.conversations ?? [];
  const trust = computeTrust(data);
  const bands = readinessBands(resources);
  const verifiedBeds = resources.filter((r) => r.type === "shelter" && r.confidence >= 85).reduce((s, r) => s + r.openBeds, 0);

  const selectedResource = selected?.kind === "resource" ? resources.find((r) => r.id === selected.id) : undefined;
  const selectedPerson = selected?.kind === "person" ? conversations.find((c) => c.id === selected.id) : undefined;

  return (
    <div className="fixed inset-0 bg-[#F6F7F8] text-[#111827]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      {/* ---------- top bar ---------- */}
      <header className="absolute inset-x-0 top-0 z-[1100] flex h-14 items-center justify-between border-b border-black/[0.07] bg-white/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="text-[#2563EB]">✦</span> POLARIS
          </Link>
          <nav className="hidden items-center gap-1 text-[13px] md:flex">
            <Tab active>Live Operations</Tab>
            <Link href="/provider"><Tab>Providers</Tab></Link>
            <Tab>Verification Queue</Tab>
            <Tab>Analytics</Tab>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden text-[12px] text-[#6B7280] sm:block">{clock}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-black/[0.08] px-2.5 py-1 text-[12px] font-medium text-[#111827]">
            <span className={`h-1.5 w-1.5 rounded-full ${err ? "bg-[#EF4444]" : "bg-[#10B981]"}`} style={{ animation: err ? undefined : "twinkle 2.4s ease-in-out infinite" }} />
            {err ? "Reconnecting" : "Live"}
          </span>
          <button onClick={reset} className="rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6]">
            Reset demo
          </button>
        </div>
      </header>

      {/* ---------- full-screen map ---------- */}
      <div className="absolute inset-0 top-14">
        <LiveMap resources={resources} people={conversations} onSelect={setSelected} />
      </div>

      {/* ---------- top-center legend ---------- */}
      <div className="glass absolute left-1/2 top-[4.5rem] z-[1000] flex -translate-x-1/2 items-center gap-3 px-3.5 py-2 text-[12px] font-medium">
        <LegendDot color={SUCCESS} label="People" />
        <LegendDot color={ACCENT} label="Shelters" />
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SUCCESS }} /> Routes</span>
      </div>

      {/* ---------- LEFT column ---------- */}
      <div className="absolute bottom-4 left-4 top-[4.5rem] z-[1000] flex w-[330px] flex-col gap-3 overflow-y-auto pb-1">
        <Panel>
          <SectionTitle>Operations Summary</SectionTitle>
          <div className="mt-3">
            <StatBar label="Trust Score" value={`${trust.score}`} sub={trust.label} pct={trust.score} color={bandColor(trust.score)} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Active" value={conversations.length} />
            <MiniStat label="Verified beds" value={verifiedBeds} color={SUCCESS} />
            <MiniStat label="Updates" value={data?.impact.providerUpdates ?? 0} color={ACCENT} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Ghost beds avoided" value={data?.impact.ghostBedsAvoided ?? 0} color={ERROR} />
            <MiniStat label="Verified routes" value={data?.impact.verifiedRoutes ?? 0} color={SUCCESS} />
          </div>
        </Panel>

        <Panel className="min-h-0 flex-1">
          <SectionTitle>Incoming Signals</SectionTitle>
          <IncomingSignals conversations={conversations} now={now} onSelect={setSelected} />
        </Panel>
      </div>

      {/* ---------- RIGHT column ---------- */}
      <div className="absolute bottom-4 right-4 top-[4.5rem] z-[1000] flex w-[380px] flex-col gap-3 overflow-y-auto pb-1">
        <Panel>
          <SectionTitle>Resource Readiness</SectionTitle>
          <div className="mt-3 space-y-2">
            <ReadinessBar label="Verified" value={bands.verified} total={bands.total} color={SUCCESS} />
            <ReadinessBar label="Aging" value={bands.aging} total={bands.total} color={WARNING} />
            <ReadinessBar label="Needs verify" value={bands.stale} total={bands.total} color="#9CA3AF" />
          </div>
          <div className="mono mt-2 text-[10px] text-[#9CA3AF]">{bands.total} shelters tracked</div>
        </Panel>

        <Panel>
          <SectionTitle>Need Compass</SectionTitle>
          <NeedCompass conversation={conversations[0]} />
        </Panel>

        <Panel>
          <SectionTitle>Ghost Bed Radar</SectionTitle>
          <GhostRadar verifications={data?.verifications ?? []} now={now} />
        </Panel>

        <Panel className="min-h-0 flex-1">
          <SectionTitle>Shelter Directory</SectionTitle>
          <Directory resources={resources} now={now} onSelect={setSelected} />
        </Panel>
      </div>

      {/* ---------- context card ---------- */}
      {(selectedResource || selectedPerson) && (
        <div className="glass absolute bottom-5 left-1/2 z-[1050] w-[360px] -translate-x-1/2 p-4">
          {selectedResource && <ResourceCard r={selectedResource} now={now} onClose={() => setSelected(null)} />}
          {selectedPerson && <PersonCard c={selectedPerson} resources={resources} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

// ---------------- primitives ----------------
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass p-4 ${className}`}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{children}</h2>;
}
function Tab({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-[#111827] text-white" : "text-[#6B7280] hover:bg-black/[0.04] hover:text-[#111827]"}`}>
      {children}
    </span>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[#374151]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: "width .5s ease" }} />
    </div>
  );
}
function StatBar({ label, value, sub, pct, color }: { label: string; value: string; sub: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-[#6B7280]">{label}</span>
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="mt-1.5"><Bar pct={pct} color={color} /></div>
      <div className="mt-1 text-[11px] text-[#9CA3AF]">{sub}</div>
    </div>
  );
}
function MiniStat({ label, value, color = "#111827" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] px-3 py-2">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="mono mt-0.5 text-[9px] uppercase tracking-wide text-[#9CA3AF]">{label}</div>
    </div>
  );
}
function ReadinessBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[#374151]">{label}</span>
        <span className="font-semibold text-[#111827]">{value}</span>
      </div>
      <div className="mt-1"><Bar pct={total ? (value / total) * 100 : 0} color={color} /></div>
    </div>
  );
}
function Empty({ hint }: { hint: string }) {
  return <div className="grid min-h-[70px] place-items-center text-center text-[12px] text-[#9CA3AF]">{hint}</div>;
}

// ---------------- panels ----------------
function IncomingSignals({ conversations, now, onSelect }: { conversations: Conversation[]; now: number; onSelect: (s: Selected) => void }) {
  if (conversations.length === 0) return <Empty hint="Text the line to light up the board." />;
  return (
    <div className="mt-2 flex max-h-full flex-col gap-2 overflow-y-auto">
      {conversations.map((c) => (
        <button key={c.id} onClick={() => onSelect({ kind: "person", id: c.id })} className="rounded-xl border border-black/[0.06] bg-white/60 p-2.5 text-left transition-colors hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.04]">
          <div className="flex items-center gap-2">
            <Avatar name={c.pseudonym} />
            <span className="text-[13px] font-semibold text-[#111827]">{c.pseudonym}</span>
            <StatusPill status={c.status} className="ml-auto" />
          </div>
          <p className="mt-1.5 line-clamp-1 text-[12px] text-[#6B7280]">“{c.lastMessage}”</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {constraintChips(c.constraints).map((ch) => (
              <span key={ch} className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-[#6B7280]">{ch}</span>
            ))}
            {c.lang === "es" && <span className="rounded bg-[#2563EB]/10 px-1.5 py-0.5 text-[10px] text-[#2563EB]">ES</span>}
            <span className="mono ml-auto text-[10px] text-[#9CA3AF]">{ago(c.updatedAt, now)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  const palette = [ACCENT, SUCCESS, WARNING, "#8B5CF6", "#0EA5E9"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const color = palette[h % palette.length];
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: `${color}1f`, color }}>{name[0]}</span>;
}
function NeedCompass({ conversation }: { conversation?: Conversation }) {
  if (!conversation) return <Empty hint="No active intake yet." />;
  const c = conversation.constraints;
  const cards: { k: string; v: string }[] = [];
  if (c.urgency) cards.push({ k: "When", v: c.urgency });
  if (c.family || c.childrenCount) cards.push({ k: "Household", v: c.childrenCount ? `1 + ${c.childrenCount} kids` : "family" });
  if (c.gender) cards.push({ k: "Identifies", v: c.gender });
  if (c.ada) cards.push({ k: "Access", v: "wheelchair" });
  if (c.pets) cards.push({ k: "Pets", v: "yes" });
  if (c.noCar) cards.push({ k: "Transit", v: "no car" });
  if (c.zip) cards.push({ k: "Near", v: c.zip });
  if (cards.length === 0) return <Empty hint="Listening for needs…" />;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div key={card.k} className="rounded-lg border border-black/[0.06] bg-black/[0.015] px-3 py-1.5">
          <div className="mono text-[10px] uppercase tracking-wide text-[#9CA3AF]">{card.k}</div>
          <div className="mt-0.5 text-[13px] font-medium capitalize text-[#111827]">{card.v}</div>
        </div>
      ))}
    </div>
  );
}
function GhostRadar({ verifications, now }: { verifications: Verification[]; now: number }) {
  if (verifications.length === 0) return <Empty hint="No verification calls yet." />;
  return (
    <div className="mt-3 flex max-h-[180px] flex-col gap-2 overflow-y-auto">
      {verifications.map((v) => {
        const s = vStatus(v.status);
        return (
          <div key={v.id} className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/60 p-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: `${s.color}1f`, color: s.color }}>{s.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-[#111827]">{v.resourceName}</div>
              <div className="mono text-[10px] text-[#9CA3AF]">family of {v.bedsNeeded} · {ago(v.respondedAt ?? v.requestedAt, now)}</div>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: s.color, background: `${s.color}14` }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
function Directory({ resources, now, onSelect }: { resources: ResourceView[]; now: number; onSelect: (s: Selected) => void }) {
  const shelters = resources.filter((r) => r.type === "shelter").sort((a, b) => b.confidence - a.confidence);
  return (
    <div className="mt-2 flex max-h-full flex-col gap-2 overflow-y-auto">
      {shelters.map((r) => {
        const c = bandColor(r.confidence);
        return (
          <button key={r.id} onClick={() => onSelect({ kind: "resource", id: r.id })} className="rounded-xl border border-black/[0.06] bg-white/60 p-2.5 text-left transition-colors hover:border-[#2563EB]/40 hover:bg-[#2563EB]/[0.04]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[#111827]">{r.name}</span>
              <span className="text-[12px] font-semibold" style={{ color: c }}>{r.confidence}%</span>
            </div>
            <div className="mt-1.5"><Bar pct={r.confidence} color={c} /></div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-[#6B7280]">{r.openBeds}/{r.totalBeds} beds</span>
              {r.servesFamilies && <Chip>family</Chip>}
              {r.adaAccessible && <Chip>ADA</Chip>}
              {r.allowsPets && <Chip>pets</Chip>}
              <span className="mono ml-auto text-[#9CA3AF]">{r.verifyMethod === "phone" ? "☎ " : ""}{ago(r.lastVerifiedAt, now)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------- context cards ----------------
function ResourceCard({ r, now, onClose }: { r: ResourceView; now: number; onClose: () => void }) {
  const c = bandColor(r.confidence);
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[#111827]">{r.name}</div>
          <div className="text-[12px] text-[#6B7280]">{r.city} · shelter</div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#111827]">{r.openBeds}</span>
        <span className="text-[12px] text-[#6B7280]">of {r.totalBeds} beds open</span>
      </div>
      <div className="mt-2"><Bar pct={r.confidence} color={c} /></div>
      <div className="mt-1.5 text-[12px] text-[#6B7280]">
        Verified {ago(r.lastVerifiedAt, now)} · {r.confidence}% confidence{r.verifyMethod === "phone" ? " (by phone)" : ""}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.servesFamilies && <Chip>Family</Chip>}
        {r.adaAccessible && <Chip>ADA</Chip>}
        {r.allowsPets && <Chip>Pets</Chip>}
        {r.genderPolicy !== "any" && <Chip>{r.genderPolicy.replace("_", " ")}</Chip>}
      </div>
    </div>
  );
}
function PersonCard({ c, resources, onClose }: { c: Conversation; resources: ResourceView[]; onClose: () => void }) {
  const match = c.topMatchId ? resources.find((r) => r.id === c.topMatchId) : undefined;
  return (
    <div>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={c.pseudonym} />
          <div>
            <div className="text-[15px] font-semibold text-[#111827]">{c.pseudonym}</div>
            <div className="text-[12px] text-[#6B7280]">Anonymous request</div>
          </div>
        </div>
        <CloseBtn onClose={onClose} />
      </div>
      <p className="mt-3 rounded-lg bg-black/[0.03] p-2.5 text-[12px] text-[#374151]">“{c.lastMessage}”</p>
      <div className="mt-2 flex items-center gap-2">
        <StatusPill status={c.status} />
        {match && <span className="text-[12px] text-[#6B7280]">→ {match.name}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {constraintChips(c.constraints).map((ch) => <Chip key={ch}>{ch}</Chip>)}
      </div>
    </div>
  );
}
function CloseBtn({ onClose }: { onClose: () => void }) {
  return <button onClick={onClose} className="grid h-6 w-6 place-items-center rounded-full text-[#9CA3AF] transition-colors hover:bg-black/[0.05] hover:text-[#111827]">✕</button>;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-[#6B7280]">{children}</span>;
}
function StatusPill({ status, className = "" }: { status: string; className?: string }) {
  const map: Record<string, [string, string]> = {
    intake: [ACCENT, "intake"], matching: [WARNING, "matching"], verifying: [WARNING, "verifying"],
    routed: [SUCCESS, "routed"], crisis: ["#8B5CF6", "crisis → 988"],
  };
  const [color, label] = map[status] ?? ["#6B7280", status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`} style={{ color, background: `${color}14` }}>{label}</span>;
}

// ---------------- helpers ----------------
function computeTrust(data: Data | null): { score: number; label: string } {
  if (!data || data.resources.length === 0) return { score: 0, label: "awaiting first signal" };
  const lastConfirmed = data.verifications.find((v) => v.status === "confirmed");
  if (lastConfirmed) {
    const r = data.resources.find((x) => x.name === lastConfirmed.resourceName);
    if (r) return { score: r.confidence, label: `${r.name} — confirmed by phone` };
  }
  const avg = Math.round(data.resources.reduce((s, r) => s + r.confidence, 0) / data.resources.length);
  return { score: avg, label: "last-known data — verify to raise trust" };
}
function readinessBands(resources: ResourceView[]) {
  const b = { verified: 0, aging: 0, stale: 0, total: 0 };
  for (const r of resources) {
    if (r.type !== "shelter") continue;
    b.total++;
    if (r.confidence >= 85) b.verified++;
    else if (r.confidence >= 50) b.aging++;
    else b.stale++;
  }
  return b;
}
function vStatus(status: string): { color: string; label: string; icon: string } {
  switch (status) {
    case "calling": return { color: WARNING, label: "Calling", icon: "☎" };
    case "confirmed": return { color: SUCCESS, label: "Confirmed", icon: "✓" };
    case "full": return { color: ERROR, label: "Avoided", icon: "✕" };
    case "no_answer": return { color: "#6B7280", label: "No answer", icon: "…" };
    default: return { color: "#6B7280", label: status, icon: "•" };
  }
}
function constraintChips(c: Constraints): string[] {
  const chips: string[] = [];
  if (c.urgency === "tonight") chips.push("tonight");
  if (c.childrenCount) chips.push(`${c.childrenCount} kids`);
  else if (c.family) chips.push("family");
  if (c.ada) chips.push("wheelchair");
  if (c.pets) chips.push("pets");
  if (c.noCar) chips.push("no car");
  if (c.zip) chips.push(c.zip);
  return chips;
}
