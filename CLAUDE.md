# Polaris — repo guide

Voice/SMS-first housing navigator that **verifies shelter availability by phone before routing anyone** (kills "ghost beds"). Next.js 16 (App Router) + TS + Tailwind v4 on Vercel; Twilio for SMS/voice. Track 2 — Housing Dignity.

## Commands

```bash
npm run dev         # dev server on :3000
npm test            # vitest (matcher + copy)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## Architecture — the owned core vs infra

Polaris owns the routing logic; the AI layer only renders language. Keep it that way.

- `lib/matcher.ts` ⭐ — pure, `now`-injected. Hard eligibility filters, then weighted score (proximity/freshness/availability/reachability). Has reasons[]. This is the defensible centerpiece; keep it unit-tested.
- `lib/orchestrator.ts` — conversation state machine: crisis check → extract → ask ZIP → rank → verify-if-stale (`VERIFY_THRESHOLD = 0.7`) → route.
- `lib/verify.ts` — Ghost Bed Radar: places the outbound Twilio call, resolves the DTMF result, updates trust, texts the person.
- `lib/constraints.ts` — deterministic EN/ES extraction + crisis detection.
- `lib/ai.ts` — deterministic, bilingual reply templates. Replies stay deterministic on purpose.
- `lib/backboard.ts` — optional Backboard LLM that enriches constraint extraction (orchestrator step 3). Gated by `BACKBOARD_API_KEY`; deterministic extraction stays authoritative and a timeout/failure falls back silently.
- `lib/store.ts` — state. In-memory by default (pinned on `globalThis` to survive HMR); auto-uses Upstash Redis if env vars present.
- `lib/resources.ts` — seed data (real SCC orgs, illustrative availability — see `DATA_NOTICE`).
- `lib/geo.ts` — ZIP centroids, haversine, transit/drive ETA.

API routes: `app/api/{sms,verify/call,verify/callback,dashboard,provider/update,reset}`. Pages: `/`, `/dashboard` (polls every 2s), `/provider`.

## Conventions

- The matcher must stay pure and `now`-injected (testable). Don't read the clock inside it.
- Outbound Twilio uses plain `fetch` (no SDK) in `lib/sms.ts`; missing creds → simulated/logged, never throws.
- The verification call targets `DEMO_SHELTER_PHONE || resource.phone` so demos never dial real shelters.
- All user-facing copy is EN/ES via `lib/ai.ts`; new messages need both.
- Safety: crisis → 988 short-circuit; no PII (identify by phone, display star-name pseudonyms).

## Demo

`POST /api/reset` re-seeds. Drive it via SMS, or JSON to `/api/sms` (`{from, body}`). Simulate the shelter keypad locally with `GET /api/verify/callback?vid=<id>&Digits=1` (1 = confirm, 2 = full).

## Env

See `.env.example`. All optional locally (simulation). Required for live telephony: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER`, `PUBLIC_BASE_URL` (tunnel/Vercel URL so Twilio can fetch TwiML), `DEMO_SHELTER_PHONE`.

## IMPORTANT

Ask before deploying to Vercel, configuring/calling Twilio, or any outward-facing action — these cost money and send real messages.
