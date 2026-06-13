# Polaris — Design Spec

**Date:** 2026-06-13 · **Event:** Milpitas Hacks 2 · **Track:** 2 — Housing Dignity
**Repo:** https://github.com/3xyy/Polaris

## Problem

People experiencing housing insecurity often lack a smartphone or data plan but can text or call. Public shelter lists go stale within hours, so someone makes a long transit trip to a "ghost bed" — a listing that says open but is full — and loses the bed elsewhere too. Dignity is being told the truth.

## Product thesis

Polaris is **not** a chatbot or a shelter map. It is a real-time **verification layer**: it understands a person's needs in plain language, ranks eligible shelters with a transparent scoring algorithm, and **confirms a real bed by phone before routing anyone**. Accessibility (any phone, no app, bilingual) is the dignity story.

## Scope — Approach A, "The Trust Layer"

In scope for the MVP:
- Inbound **SMS** intake (real Twilio).
- Constraint extraction (urgency, family/children, gender, ADA, pets, transportation, ZIP), EN + ES.
- **Constraint-aware matcher** (owned, tested): hard eligibility filters + weighted score.
- **Ghost Bed Radar**: outbound **voice** verification call using keypad/DTMF ("press 1 = space, 2 = full") — reliable enough to run live.
- **Live Sky** dashboard (judge-facing visual): Incoming Signals, Need Compass, Resource Constellation, Ghost Bed Radar, Trust Score, Impact counters.
- **Provider Beacon**: shelters report availability in plain text ("FULL", "3 OPEN") — by SMS or a web console.
- Safety: crisis → 988 handoff. Privacy: no PII, star-name pseudonyms.

Explicitly out of scope (named as future work): inbound voice IVR, benefits eligibility screener, document concierge, warm-transfer bridging, mutual-aid matching.

Note on a mid-build pivot: an early variant framed `/demo` as a fake web "SMS simulator." This was dropped — the product uses **real Twilio** telephony; verification is a real outbound call, not a simulation. The dashboard/provider pages are real product surfaces, not mockups.

## Architecture

Single Next.js app on Vercel. Twilio owns the number (inbound SMS webhook + outbound voice). The AI layer renders language only; Polaris owns the routing decisions.

```
SMS/Voice → Twilio → /api/sms → orchestrator → matcher → ranked shelters
                                     │ (top stale) → /api/verify/call (DTMF)
                                     │              → /api/verify/callback → trust++, text the person
                          store (in-memory | Redis) → /api/dashboard → Live Sky (2s poll)
```

**Owned & defensible:** `lib/matcher.ts`, `lib/orchestrator.ts`, `lib/verify.ts`, `lib/constraints.ts`.
**Infra:** Twilio, Upstash Redis (optional), Next.js/Vercel.

## Key decisions

- **Deterministic AI floor.** Constraint extraction and reply composition are rule-based and bilingual (`lib/constraints.ts`, `lib/ai.ts`), so the live demo never depends on an external model call. An LLM (Backboard / Vercel AI Gateway) can be added at the `lib/ai.ts` seam to paraphrase/translate, with the deterministic path as fallback.
- **DTMF, not speech.** The verification call asks one keypad question — robust in a noisy demo room; a judge can be the shelter and press 1.
- **Verify-on-staleness.** Confidence is exponential decay on time-since-verified. Below `VERIFY_THRESHOLD = 0.7`, Polaris will not route without a live re-confirmation. Fresh resources route immediately.
- **State store abstraction.** In-memory by default (pinned on `globalThis` to survive Next dev HMR), auto-upgrading to Upstash Redis when env vars are present — so the same code runs locally and survives multi-instance serverless.
- **Matcher is pure & `now`-injected** for testability.

## Data model

- `Resource` — location, hours (incl. intake cutoff), capabilities (families/family-capacity/gender/ADA/pets/sobriety), `openBeds`, `lastVerifiedAt`, `verifyMethod`.
- `Conversation` — keyed by phone; accreted `constraints`, `lang`, `status`, `topMatchId`. Powers Incoming Signals.
- `Verification` — resource, status (scanning/calling/confirmed/full/no_answer), timestamps. Powers the Radar + impact.
- `ImpactCounters` — ghost beds avoided, verified routes, provider updates.

## Scoring

`score = 0.30·proximity + 0.30·freshness + 0.15·availability + 0.25·reachability` (0–100). Reachability collapses for options that can't be reached before intake closes — the ghost trip we prevent. Every result carries human-readable `reasons[]`.

## Verification & status

Functionally verified end-to-end (confirm, full/ghost-bed-avoided, fresh route, CALL, crisis, Spanish, provider beacon). 20 unit tests pass; production build + typecheck clean. UI verified via screenshots, no console errors.
