"use client";

import { useCallback, useEffect, useState } from "react";

// ---- shapes returned by /api/dashboard ----
interface Constraints {
  zip?: string;
  urgency?: string;
  family?: boolean;
  childrenCount?: number;
  gender?: string;
  ada?: boolean;
  pets?: boolean;
  noCar?: boolean;
}
interface Conversation {
  id: string;
  pseudonym: string;
  lang: string;
  constraints: Constraints;
  lastMessage: string;
  status: string;
  updatedAt: number;
}
interface Verification {
  id: string;
  resourceName: string;
  status: string;
  bedsNeeded: number;
  requestedAt: number;
  respondedAt: number | null;
}
interface ResourceView {
  id: string;
  name: string;
  type: string;
  city: string;
  openBeds: number;
  totalBeds: number;
  genderPolicy: string;
  adaAccessible: boolean;
  allowsPets: boolean;
  servesFamilies: boolean;
  verifyMethod: string;
  lastVerifiedAt: number | null;
  confidence: number;
}
interface Data {
  now: number;
  impact: { ghostBedsAvoided: number; verifiedRoutes: number; providerUpdates: number };
  conversations: Conversation[];
  verifications: Verification[];
  resources: ResourceView[];
}

function ago(ts: number | null, now: number): string {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);

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

  const reset = async () => {
    await fetch("/api/reset", { method: "POST" });
    load();
  };

  const now = data?.now ?? Date.now();
  const trust = computeTrust(data);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Live Sky</h1>
          <p className="mt-1 text-sm text-muted">
            Real-time housing navigation — every routed bed is phone-verified first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="pill text-confirmed">
            <span className={`h-1.5 w-1.5 rounded-full ${err ? "bg-full" : "bg-confirmed animate-twinkle"}`} />
            {err ? "reconnecting" : "live · 2s"}
          </span>
          <button
            onClick={reset}
            className="rounded-full border border-edge bg-white/5 px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            Reset demo
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrustTile trust={trust} />
        <Kpi label="Ghost beds avoided" value={data?.impact.ghostBedsAvoided ?? 0} tone="full" hint="full / no-answer caught before routing" />
        <Kpi label="Verified routes" value={data?.impact.verifiedRoutes ?? 0} tone="confirmed" hint="confirmed beds sent to people" />
        <Kpi label="Provider updates" value={data?.impact.providerUpdates ?? 0} tone="sky" hint="beacons from shelters" />
      </div>

      {/* main grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Incoming Signals" subtitle="people reaching out">
          <IncomingSignals conversations={data?.conversations ?? []} now={now} />
        </Section>

        <div className="flex flex-col gap-4">
          <Section title="Need Compass" subtitle="latest extracted needs">
            <NeedCompass conversation={data?.conversations?.[0]} />
          </Section>
          <Section title="Ghost Bed Radar" subtitle="live verification calls">
            <GhostRadar verifications={data?.verifications ?? []} now={now} />
          </Section>
        </div>

        <Section title="Resource Constellation" subtitle="confidence by freshness">
          <Constellation resources={data?.resources ?? []} now={now} />
        </Section>
      </div>
    </div>
  );
}

// ---------------- Trust ----------------
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

function TrustTile({ trust }: { trust: { score: number; label: string } }) {
  const color = trust.score >= 85 ? "var(--color-confirmed)" : trust.score >= 50 ? "var(--color-stale)" : "var(--color-full)";
  return (
    <div className="panel panel-glow flex items-center gap-4 p-4">
      <div
        className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${trust.score * 3.6}deg, var(--color-edge) 0deg)` }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-panel">
          <span className="text-sm font-bold text-ink">{trust.score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mono text-[11px] uppercase tracking-wider text-muted">Trust Score</div>
        <div className="mt-0.5 truncate text-sm text-ink">{trust.label}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number; tone: "full" | "confirmed" | "sky"; hint: string }) {
  const color = tone === "full" ? "text-full" : tone === "confirmed" ? "text-confirmed" : "text-sky";
  return (
    <div className="panel p-4">
      <div className="mono text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] text-faint">{hint}</div>
    </div>
  );
}

// ---------------- Section shell ----------------
function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="panel flex min-h-[200px] flex-col p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>
        <span className="mono text-[10px] uppercase tracking-wider text-faint">{subtitle}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ---------------- Incoming Signals ----------------
function IncomingSignals({ conversations, now }: { conversations: Conversation[]; now: number }) {
  if (conversations.length === 0) return <Empty hint="Text the line (or POST /api/sms) to light up the board." />;
  return (
    <div className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto pr-1">
      {conversations.map((c) => (
        <div key={c.id} className="animate-rise rounded-xl border border-edge bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{c.pseudonym}</span>
            <StatusDot status={c.status} />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">“{c.lastMessage}”</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {constraintChips(c.constraints).map((chip) => (
              <span key={chip} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">{chip}</span>
            ))}
            {c.lang === "es" && <span className="rounded-md bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet">ES</span>}
            <span className="mono ml-auto text-[10px] text-faint">{ago(c.updatedAt, now)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Need Compass ----------------
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
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div key={card.k} className="rounded-lg border border-edge bg-white/[0.02] px-3 py-2">
          <div className="mono text-[10px] uppercase tracking-wider text-faint">{card.k}</div>
          <div className="mt-0.5 text-sm font-medium capitalize text-ink">{card.v}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Ghost Bed Radar ----------------
function GhostRadar({ verifications, now }: { verifications: Verification[]; now: number }) {
  if (verifications.length === 0) return <Empty hint="No verification calls yet." />;
  return (
    <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
      {verifications.map((v) => {
        const s = statusMeta(v.status);
        return (
          <div key={v.id} className="animate-rise flex items-center gap-3 rounded-xl border border-edge bg-white/[0.02] p-2.5">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${v.status === "calling" ? "animate-pulse-ring" : ""}`}
              style={{ background: `${s.color}22`, color: s.color }}
            >
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{v.resourceName}</div>
              <div className="mono text-[10px] text-faint">family of {v.bedsNeeded} · {ago(v.respondedAt ?? v.requestedAt, now)}</div>
            </div>
            <span className="pill shrink-0" style={{ color: s.color, borderColor: `${s.color}55` }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Resource Constellation ----------------
function Constellation({ resources, now }: { resources: ResourceView[]; now: number }) {
  const sorted = [...resources].sort((a, b) => {
    if (a.type !== b.type) return a.type === "shelter" ? -1 : 1;
    return b.confidence - a.confidence;
  });
  return (
    <div className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto pr-1">
      {sorted.map((r) => {
        const c = r.confidence >= 85 ? "var(--color-confirmed)" : r.confidence >= 50 ? "var(--color-stale)" : "var(--color-faint)";
        return (
          <div key={r.id} className="rounded-xl border border-edge bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-ink">{r.name}</span>
              <span className="mono shrink-0 text-[11px]" style={{ color: c }}>{r.confidence}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-edge">
              <div className="h-full rounded-full" style={{ width: `${r.confidence}%`, background: c }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-muted">{r.type === "shelter" ? `${r.openBeds}/${r.totalBeds} beds` : r.type}</span>
              {r.servesFamilies && <Tag>family</Tag>}
              {r.adaAccessible && <Tag>ADA</Tag>}
              {r.allowsPets && <Tag>pets</Tag>}
              {r.genderPolicy !== "any" && <Tag>{r.genderPolicy.replace("_", " ")}</Tag>}
              <span className="mono ml-auto text-faint">
                {r.verifyMethod === "phone" ? "☎ " : ""}
                {ago(r.lastVerifiedAt, now)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- small bits ----------------
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-white/5 px-1.5 py-0.5 text-muted">{children}</span>;
}
function Empty({ hint }: { hint: string }) {
  return <div className="grid h-full min-h-[120px] place-items-center text-center text-[13px] text-faint">{hint}</div>;
}
function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    intake: ["var(--color-sky)", "intake"],
    matching: ["var(--color-stale)", "matching"],
    verifying: ["var(--color-north)", "verifying"],
    routed: ["var(--color-confirmed)", "routed"],
    crisis: ["var(--color-violet)", "crisis → 988"],
  };
  const [color, label] = map[status] ?? ["var(--color-muted)", status];
  return (
    <span className="pill" style={{ color, borderColor: `${color}55` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
function statusMeta(status: string): { color: string; label: string; icon: string } {
  switch (status) {
    case "calling": return { color: "var(--color-north)", label: "Calling…", icon: "☎" };
    case "confirmed": return { color: "var(--color-confirmed)", label: "Confirmed", icon: "✓" };
    case "full": return { color: "var(--color-full)", label: "Full — avoided", icon: "✕" };
    case "no_answer": return { color: "var(--color-muted)", label: "No answer", icon: "…" };
    case "scanning": return { color: "var(--color-sky)", label: "Scanning", icon: "◎" };
    default: return { color: "var(--color-muted)", label: status, icon: "•" };
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
