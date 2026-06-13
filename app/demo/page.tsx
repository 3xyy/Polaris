"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatItem =
  | { kind: "msg"; role: "user" | "polaris"; text: string; id: number }
  | { kind: "verify"; vid: string; resolved: null | "1" | "2"; id: number };

const QUICK = [
  "I need somewhere to sleep tonight. I have my 2 kids and no car.",
  "95035",
  "necesito dormir esta noche con mis 2 hijos",
];

export default function Demo() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const next = () => ++seq.current;

  // Stable per-session "phone number" (client-only to avoid hydration mismatch).
  useEffect(() => {
    setFrom(`+1408${Math.floor(1000000 + Math.random() * 9000000)}`);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy || !from) return;
      setInput("");
      setItems((p) => [...p, { kind: "msg", role: "user", text, id: next() }]);
      setBusy(true);
      try {
        const res = await fetch("/api/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, body: text }),
        });
        const data = (await res.json()) as {
          replies: string[];
          verificationStarted: boolean;
          verificationId?: string;
        };
        const add: ChatItem[] = data.replies.map((t) => ({ kind: "msg", role: "polaris", text: t, id: next() }));
        if (data.verificationStarted && data.verificationId) {
          add.push({ kind: "verify", vid: data.verificationId, resolved: null, id: next() });
        }
        setItems((p) => [...p, ...add]);
      } finally {
        setBusy(false);
      }
    },
    [busy, from],
  );

  const answerShelter = useCallback(async (vid: string, digit: "1" | "2", itemId: number) => {
    setItems((p) => p.map((it) => (it.id === itemId && it.kind === "verify" ? { ...it, resolved: digit } : it)));
    const res = await fetch(`/api/verify/callback?vid=${vid}&Digits=${digit}&format=json`, { method: "POST" });
    const data = (await res.json()) as { message?: string };
    if (data.message) {
      setItems((p) => [...p, { kind: "msg", role: "polaris", text: data.message!, id: next() }]);
    }
  }, []);

  const reset = async () => {
    await fetch("/api/reset", { method: "POST" });
    setItems([]);
    setFrom(`+1408${Math.floor(1000000 + Math.random() * 9000000)}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Try Polaris</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
          Text the way someone in need would. This runs the <span className="text-ink">real backend</span> —
          the matcher, the Ghost Bed Radar, and the live dashboard. Open{" "}
          <Link href="/dashboard" target="_blank" className="text-aurora underline-offset-2 hover:underline">
            Live Sky
          </Link>{" "}
          in another window and watch it update as you go.
        </p>
      </div>

      {/* phone */}
      <div className="w-full max-w-sm">
        <div className="panel panel-glow overflow-hidden rounded-[2.2rem] p-0">
          {/* status bar */}
          <div className="flex items-center justify-between border-b border-edge bg-void/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-north/15 text-north">★</span>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-ink">Polaris</div>
                <div className="mono text-[10px] text-faint">SMS · +1 (408) 555-0117</div>
              </div>
            </div>
            <button onClick={reset} className="mono text-[10px] text-faint hover:text-ink">
              new demo
            </button>
          </div>

          {/* chat */}
          <div ref={scroller} className="flex h-[460px] flex-col gap-2.5 overflow-y-auto bg-void/30 p-4">
            {items.length === 0 && (
              <div className="m-auto max-w-[80%] text-center text-[13px] text-faint">
                Tap a suggestion below to start — or type your own message.
              </div>
            )}
            {items.map((it) =>
              it.kind === "msg" ? (
                <Bubble key={it.id} role={it.role} text={it.text} />
              ) : (
                <VerifyCard
                  key={it.id}
                  item={it}
                  onAnswer={(digit) => answerShelter(it.vid, digit, it.id)}
                />
              ),
            )}
            {busy && <Bubble role="polaris" text="…" muted />}
          </div>

          {/* composer */}
          <div className="border-t border-edge bg-void/60 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={busy}
                  className="rounded-full border border-edge bg-white/5 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-aurora/50 hover:text-ink disabled:opacity-40"
                >
                  {q.length > 30 ? q.slice(0, 30) + "…" : q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-edge bg-void/70 px-4 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-aurora/50"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-aurora text-void transition-transform hover:scale-105 disabled:opacity-40"
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
        <p className="mono mt-3 text-center text-[10px] text-faint">
          Demo transport (web) · identical logic to the wired Twilio/Telnyx SMS + voice path
        </p>
      </div>
    </div>
  );
}

function Bubble({ role, text, muted }: { role: "user" | "polaris"; text: string; muted?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`animate-rise max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
          isUser
            ? "rounded-br-md bg-aurora/20 text-ink"
            : `rounded-bl-md border border-edge bg-panel-2 ${muted ? "text-faint" : "text-ink"}`
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function VerifyCard({ item, onAnswer }: { item: Extract<ChatItem, { kind: "verify" }>; onAnswer: (d: "1" | "2") => void }) {
  const [ringing, setRinging] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRinging(false), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="animate-rise mx-auto w-[88%] rounded-2xl border border-north/30 bg-north/5 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-north/15 text-north animate-pulse-ring">☎</span>
        <div className="text-[12px] font-semibold text-north">Ghost Bed Radar — verifying by phone</div>
      </div>
      {item.resolved ? (
        <div className="mono mt-2 text-[11px] text-muted">
          {item.resolved === "1" ? "Shelter pressed 1 — space confirmed ✓" : "Shelter pressed 2 — full ✕ (ghost bed avoided)"}
        </div>
      ) : ringing ? (
        <div className="mono mt-2 text-[11px] text-faint">Calling the shelter…</div>
      ) : (
        <div className="mt-2.5">
          <div className="mono mb-1.5 text-[10px] uppercase tracking-wider text-faint">You are the shelter — answer:</div>
          <div className="flex gap-2">
            <button
              onClick={() => onAnswer("1")}
              className="flex-1 rounded-lg border border-confirmed/40 bg-confirmed/10 px-2 py-1.5 text-[12px] font-medium text-confirmed transition-colors hover:bg-confirmed/20"
            >
              🛏 Press 1 — has space
            </button>
            <button
              onClick={() => onAnswer("2")}
              className="flex-1 rounded-lg border border-full/40 bg-full/10 px-2 py-1.5 text-[12px] font-medium text-full transition-colors hover:bg-full/20"
            >
              🚫 Press 2 — full
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
