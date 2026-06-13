import Link from "next/link";
import { PolarisMark } from "@/components/PolarisMark";
import { DATA_NOTICE } from "@/lib/resources";

const POLARIS_NUMBER = process.env.NEXT_PUBLIC_POLARIS_NUMBER ?? "+1 (408) 555-0117";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ---------------- HERO ---------------- */}
      <section className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="animate-rise">
          <span className="pill text-north">
            <PolarisMark size={14} />
            Housing Dignity · Santa Clara County
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Polaris kills{" "}
            <span className="text-north text-glow-north">ghost beds</span> by
            verifying availability before sending someone across town.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            A voice &amp; SMS-first navigator for people experiencing housing
            insecurity. No app, no data plan, no smartphone required. Polaris
            understands a person&apos;s situation, finds eligible shelters, then{" "}
            <span className="text-ink">picks up the phone to confirm a real bed</span>{" "}
            — so no one is sent to a door that&apos;s already closed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-north px-6 py-3 text-sm font-semibold text-void shadow-[0_0_30px_-6px_rgba(247,201,90,0.6)] transition-transform hover:scale-[1.03]"
            >
              Open the Live Sky →
            </Link>
            <Link
              href="/provider"
              className="rounded-full border border-edge bg-white/5 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/10"
            >
              Provider Beacon
            </Link>
          </div>
          <p className="mono mt-6 text-sm text-muted">
            Or just text{" "}
            <span className="text-aurora">{POLARIS_NUMBER}</span> — works on any phone.
          </p>
        </div>

        <HeroPreview />
      </section>

      {/* ---------------- THE PROBLEM ---------------- */}
      <section className="border-y border-edge/60 bg-deep/40">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Stat figure="1 in 4" label="“open” shelter listings are already full by the time someone arrives" />
            <Stat figure="2+ hrs" label="a wasted trip across town by bus can cost — and the bed at the next place too" tone="full" />
            <Stat figure="0" label="beds Polaris reports as open without re-confirming them live" tone="confirmed" />
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-aurora">
          How Polaris works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-2xl font-semibold text-ink">
          Three steps, entirely over text or a phone call.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Step
            n="01"
            title="Understand"
            accent="text-sky"
            body="Polaris reads a plain-language message — “somewhere to sleep tonight, my 2 kids, no car” — and extracts the real constraints: urgency, family size, accessibility, transportation, ZIP."
          />
          <Step
            n="02"
            title="Verify"
            accent="text-north"
            body="Instead of trusting a stale list, Polaris places a real call to the shelter and asks one keypad question: do you have space tonight? Confirmed in seconds — the Ghost Bed Radar."
          />
          <Step
            n="03"
            title="Route"
            accent="text-confirmed"
            body="Only a confirmed bed gets sent — with the address, intake cutoff, and a transit ETA. “Confirmed 12 seconds ago.” Dignity is being told the truth."
          />
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
        <p className="mt-2 text-xs text-faint">Polaris · Milpitas Hacks 2 · Track 2 — Housing Dignity</p>
      </footer>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="panel panel-glow relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <span className="pill text-aurora">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora animate-twinkle" /> Ghost Bed Radar
          </span>
          <span className="mono text-[11px] text-muted">live</span>
        </div>

        {/* radar */}
        <div className="relative mx-auto my-6 h-40 w-40">
          <div className="absolute inset-0 rounded-full border border-edge" />
          <div className="absolute inset-6 rounded-full border border-edge/70" />
          <div className="absolute inset-12 rounded-full border border-edge/50" />
          <div className="absolute inset-0 origin-center animate-sweep">
            <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-aurora to-transparent" />
          </div>
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-north shadow-[0_0_12px_4px_rgba(247,201,90,0.5)]" />
          <div className="absolute left-[30%] top-[35%] h-1.5 w-1.5 rounded-full bg-confirmed" />
          <div className="absolute left-[68%] top-[58%] h-1.5 w-1.5 rounded-full bg-stale" />
        </div>

        {/* confirmed text bubble */}
        <div className="rounded-2xl rounded-bl-md border border-confirmed/30 bg-confirmed/10 p-3.5 text-[13px] leading-relaxed text-ink">
          <span className="font-semibold text-confirmed">✅ Confirmed 12s ago:</span> San
          José Family Shelter has space tonight for 1 adult + 2 children. Intake closes
          9 PM. ~18 min by transit. Reply CALL and I&apos;ll let them know you&apos;re coming.
        </div>
        <div className="mono mt-2 text-right text-[11px] text-muted">Polaris · SMS</div>
      </div>
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
    <div className="panel p-6">
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
