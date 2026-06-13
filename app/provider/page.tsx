"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ResourceView {
  id: string;
  name: string;
  type: string;
  city: string;
  openBeds: number;
  totalBeds: number;
  confidence: number;
  verifyMethod: string;
}
interface LogEntry { name: string; update: string; openBeds: number; at: number }

const PRESETS = ["FULL", "3 OPEN", "FAMILY ROOM OPEN UNTIL 9PM", "5 BEDS OPEN"];

export default function Provider() {
  const [resources, setResources] = useState<ResourceView[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sending, setSending] = useState(false);

  const loadResources = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await res.json();
    const shelters = (data.resources as ResourceView[]).filter((r) => r.type === "shelter");
    setResources(shelters);
    setSelected((cur) => cur || shelters[0]?.id || "");
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const send = async (update: string) => {
    if (!selected || !update.trim()) return;
    setSending(true);
    const res = await fetch("/api/provider/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: selected, update }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) {
      setLog((l) => [{ name: data.resource.name, update, openBeds: data.resource.openBeds, at: Date.now() }, ...l].slice(0, 8));
      setText("");
      loadResources();
    }
  };

  const current = resources.find((r) => r.id === selected);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Provider Beacon</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Shelters report their own availability in plain language — by text or here. Polaris
            freshens the listing instantly, so no one is routed on stale data.
          </p>
        </div>
        <Link href="/dashboard" className="shrink-0 rounded-full border border-edge bg-white/5 px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-white/10 hover:text-ink">
          View Live Sky →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
        {/* selector */}
        <div className="panel p-4">
          <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Select your shelter</div>
          <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
            {resources.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  selected === r.id ? "border-north/60 bg-north/10" : "border-edge bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                  <span className="mono text-[11px] text-muted">{r.openBeds}/{r.totalBeds}</span>
                </div>
                <div className="mono mt-0.5 text-[10px] text-faint">{r.city} · {r.confidence}% fresh</div>
              </button>
            ))}
          </div>
        </div>

        {/* beacon console */}
        <div className="panel panel-glow flex flex-col p-4">
          <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Send a beacon</div>
          {current ? (
            <>
              <div className="rounded-xl border border-edge bg-white/[0.02] p-3">
                <div className="text-sm font-semibold text-ink">{current.name}</div>
                <div className="mono mt-0.5 text-[11px] text-muted">
                  now: {current.openBeds} open of {current.totalBeds}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    disabled={sending}
                    onClick={() => send(p)}
                    className="rounded-full border border-edge bg-white/5 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-aurora/50 hover:bg-aurora/10 disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(text)}
                  placeholder="e.g. 2 OPEN, or FULL"
                  className="mono flex-1 rounded-lg border border-edge bg-void/60 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-aurora/50"
                />
                <button
                  disabled={sending || !text.trim()}
                  onClick={() => send(text)}
                  className="rounded-lg bg-aurora px-4 py-2 text-sm font-semibold text-void transition-transform hover:scale-[1.03] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-faint">Loading shelters…</div>
          )}

          {/* log */}
          {log.length > 0 && (
            <div className="mt-4 border-t border-edge pt-3">
              <div className="mono mb-2 text-[10px] uppercase tracking-wider text-faint">Recent beacons</div>
              <div className="flex flex-col gap-1.5">
                {log.map((e, i) => (
                  <div key={i} className="animate-rise flex items-center justify-between text-[12px]">
                    <span className="text-muted">
                      <span className="text-ink">{e.name}</span> · “{e.update}”
                    </span>
                    <span className="mono text-confirmed">→ {e.openBeds} open</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mono mt-6 text-center text-[11px] text-faint">
        In production, shelters text these same words to the Polaris line — no portal, no login.
      </p>
    </div>
  );
}
