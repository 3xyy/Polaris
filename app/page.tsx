import Link from "next/link";
import { PolarisMark } from "@/components/PolarisMark";
import { Donut } from "@/components/Donut";
import { DATA_NOTICE } from "@/lib/resources";

const POLARIS_NUMBER = process.env.NEXT_PUBLIC_POLARIS_NUMBER ?? "+1 (408) 889-7563";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ---------------- HERO ---------------- */}
      <section className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="animate-rise">
          <span className="pill text-north">
            <PolarisMark size={14} />
            Housing Dignity · Santa Clara County
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.6rem]">
            Stop sending people to{" "}
            <span className="text-north text-glow-north">ghost beds.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Polaris is a voice &amp; SMS navigator for people facing housing insecurity — no app, no
            data, no smartphone. It understands a person&apos;s situation, finds eligible shelters, then{" "}
            <span className="text-ink">calls to confirm a real bed before sending anyone across town.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="rounded-full bg-north px-6 py-3 text-sm font-semibold text-void shadow-[0_0_30px_-6px_rgba(247,201,90,0.6)] transition-transform hover:scale-[1.03]"
            >
              Try the live demo →
            </Link>
            <Link href="/dashboard" className="card-lift rounded-full border border-edge bg-white/5 px-6 py-3 text-sm font-semibold text-ink">
              Open Live Sky
            </Link>
            <Link href="/provider" className="card-lift rounded-full border border-edge bg-white/5 px-6 py-3 text-sm font-semibold text-ink">
              Provider Beacon
            </Link>
          </div>
          <p className="mono mt-6 text-sm text-muted">
            On a real phone, text <span className="text-aurora">{POLARIS_NUMBER}</span> — SMS/voice wired for Twilio.
          </p>
        </div>

        <HeroPreview />
      </section>

      {/* ---------------- THE PROBLEM ---------------- */}
      <section className="border-y border-edge/60 bg-deep/40">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Stat figure="1 in 4" label="“open” shelter listings are already full by the time someone arrives" />
            <Stat figure="2+ hrs" label="a wasted bus trip across town can cost — and the bed elsewhere too" tone="full" />
            <Stat figure="0" label="beds Polaris reports as open without re-confirming them live" tone="confirmed" />
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-aurora">How Polaris works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-2xl font-semibold text-ink">
          Three steps, entirely over text or a phone call.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Step n="01" title="Understand" accent="text-sky" body="Polaris reads a plain-language message — “somewhere to sleep tonight, my 2 kids, no car” — and extracts the real constraints: urgency, family size, accessibility, transportation, ZIP." />
          <Step n="02" title="Verify" accent="text-north" body="Instead of trusting a stale list, Polaris places a real call to the shelter and asks one keypad question: do you have space tonight? Confirmed in seconds — the Ghost Bed Radar." />
          <Step n="03" title="Route" accent="text-confirmed" body="Only a confirmed bed gets sent — with the address, intake cutoff, and a transit ETA. “Confirmed 12 seconds ago.” Dignity is being told the truth." />
        </div>
      </section>

      {/* ---------------- CHANNELS / ACCESSIBILITY ---------------- */}
      <section className="border-t border-edge/60 bg-deep/40">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-5 py-16 md:grid-cols-3">
          <Feature title="Any phone, no app" body="Plain SMS or a voice call. Built for a $20 flip phone with no data plan — the people who need it most." />
          <Feature title="Bilingual by default" body="Responds in English or Spanish automatically, matching how someone reaches out." />
          <Feature title="Privacy by design" body="No legal name, no SSN. Identified only by phone; shown on the board as a star name. Crisis messages route to 988, not a bot." />
        </div>
      </section>

      <footer className="mx-auto w-full max-w-7xl px-5 py-10 text-center">
        <p className="mono text-xs leading-relaxed text-faint">{DATA_NOTICE}</p>
        <p className="mt-2 text-xs text-faint">
          Polaris · Milpitas Hacks · Track 2 — Housing Dignity ·{" "}
          <Link href="/privacy" className="hover:text-muted">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:text-muted">Terms</Link>
        </p>
      </footer>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="panel panel-glow relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="text-north">★</span> Live Sky
          </span>
          <span className="pill text-confirmed">
            <span className="h-1.5 w-1.5 rounded-full bg-confirmed animate-twinkle" /> live
          </span>
        </div>

        {/* mini KPIs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniKpi value="3" label="ghost beds avoided" tone="text-full" />
          <MiniKpi value="12" label="verified routes" tone="text-confirmed" />
          <MiniKpi value="99%" label="trust score" tone="text-north" />
        </div>

        {/* donut + confirmed bubble */}
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-edge bg-white/[0.02] p-3">
          <Donut
            size={104}
            thickness={12}
            segments={[
              { label: "Verified", value: 6, color: "var(--color-confirmed)" },
              { label: "Aging", value: 2, color: "var(--color-stale)" },
              { label: "Stale", value: 1, color: "var(--color-faint)" },
            ]}
            centerTop="67%"
            centerBottom="live"
          />
          <div className="flex flex-col gap-1.5 text-[12px]">
            <Legend color="var(--color-confirmed)" label="Verified" v="6" />
            <Legend color="var(--color-stale)" label="Aging" v="2" />
            <Legend color="var(--color-faint)" label="Needs verify" v="1" />
          </div>
        </div>

        <div className="mt-3 rounded-2xl rounded-bl-md border border-confirmed/30 bg-confirmed/10 p-3.5 text-[13px] leading-relaxed text-ink">
          <span className="font-semibold text-confirmed">✅ Confirmed 12s ago:</span> San José Family Shelter
          has space tonight for 1 adult + 2 children. Intake closes 9 PM. ~18 min by transit.
        </div>
        <div className="mono mt-2 text-right text-[11px] text-muted">Polaris · SMS</div>
      </div>
    </div>
  );
}

function MiniKpi({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-edge bg-white/[0.02] p-2.5">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="mono mt-0.5 text-[9px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}
function Legend({ color, label, v }: { color: string; label: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-semibold text-ink">{v}</span>
    </div>
  );
}

function Stat({ figure, label, tone = "north" }: { figure: string; label: string; tone?: "north" | "full" | "confirmed" }) {
  const color = tone === "full" ? "text-full" : tone === "confirmed" ? "text-confirmed" : "text-north";
  return (
    <div>
      <div className={`text-4xl font-bold ${color}`}>{figure}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{label}</p>
    </div>
  );
}

function Step({ n, title, body, accent }: { n: string; title: string; body: string; accent: string }) {
  return (
    <div className="panel card-lift p-6">
      <div className="flex items-baseline gap-3">
        <span className={`mono text-sm ${accent}`}>{n}</span>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
        <PolarisMark size={15} /> {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
