# Polaris — Architecture & Technical Rundown

> A voice/SMS-first housing navigator that **verifies a shelter bed by phone before routing
> anyone**, then sends real street directions. Built for Milpitas Hacks · Track 2 (Housing Dignity).

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** | One repo for webhooks (API routes) + the dashboard; deploys natively on Vercel |
| Styling | **Tailwind v4** | Light "ops-center" design system via CSS tokens |
| Messaging | **Twilio** (SMS + WhatsApp), **Telnyx** adapter | A2P-independent demo via WhatsApp; SMS switches on when A2P clears |
| Voice | **Twilio Voice (TwiML + DTMF)** | The verification call — keypad, not speech, so it's reliable live |
| Maps | **Mapbox** (Directions, Static Images, Geocoding) + **Leaflet/react-leaflet** | Real street routing + the live dashboard map |
| AI | **Deterministic extractor** + optional **Backboard** (sponsor) | Rule-based floor that never fails; LLM enriches off-script phrasing |
| State | **Upstash Redis** (Vercel Marketplace), in-memory fallback | Shared state across serverless invocations |
| Hosting | **Vercel** | Live at mhs-navy.vercel.app |
| Tests | **Vitest** | 31 unit tests over the matcher, extractor, and copy |

The split that matters: **Polaris owns the routing logic** (matcher, orchestrator, verification);
infrastructure (Twilio, Mapbox, Redis) is plumbing, and the AI layer only renders language.

---

## 2. High-level architecture

```
                         ┌──────────────────────────────────────────┐
  Person's phone         │                 VERCEL                    │
  (SMS / WhatsApp) ─────▶│  /api/sms ──▶ orchestrator ──▶ matcher    │
        ▲                │     │              │             │        │
        │ reply          │     │              ▼             ▼        │
        │                │     │        verify.ts ──▶ Twilio Voice ──┼──▶ shelter phone
        │                │     │        (Ghost Bed Radar, DTMF)      │     "press 1 / 2"
        │                │     │              ▲                      │
        └────────────────┼─────┘     /api/verify/callback ◀─────────┼──── keypad result
                         │                    │                      │
   shares location 📍 ───┼──▶ handleLocation ─┘  Mapbox Directions ──┼──▶ map image + steps
                         │                                           │
                         │  Upstash Redis  ◀── state ──▶ /api/dashboard
                         └──────────────────────────────┬───────────┘
                                                         ▼
                                          Live Sky dashboard (polls 2s)
                                          full-screen Mapbox map + panels
```

---

## 3. The request lifecycle (a text comes in)

1. **`/api/sms`** receives the webhook. It handles three sources — Twilio (form), Telnyx (JSON),
   and a JSON test harness used by the `/demo` simulator — plus two payload kinds: a **message**
   or a **shared location**.
2. **`orchestrator.handleInbound`** runs the state machine, in order:
   - **Crisis check** → if self-harm language, stop and route to **988** (EN/ES).
   - **Commands** → `HELP`, `CALL`, `FOOD`, `SHOWER`, `YES`.
   - **Constraint extraction** (`constraints.ts`) → urgency, family, children, gender, ADA, pets,
     transportation. Deterministic; **Backboard** only fills gaps when the rule pass is thin.
   - **Location-first** → if we don't yet have the person's location, ask them to share it
     (WhatsApp native) or type an address (geocoded by Mapbox). **No ZIP is ever requested.**
   - **`matchAndRoute`** → rank eligible shelters from the person's real coordinate.
3. **`matchAndRoute`**:
   - **Stale top match** (confidence < 0.7) → `beginVerification` places a real outbound call.
   - **Fresh top match** → `composeRoute` builds directions + map + a nearby plan and routes now.
4. **Verification** (`/api/verify/call` → `/api/verify/callback`): the shelter presses **1**
   (confirm → route + directions + map) or **2** (full → "ghost bed avoided" → fail over).
5. Every step writes to **Redis**, which **`/api/dashboard`** serves to the Live Sky board.

## 4. The directions/map lifecycle

`composeRoute` (in `verify.ts`) calls **Mapbox Directions** (real street geometry + turn-by-turn),
formats steps with distance (ft/mi) and street names, appends the **nearest food + showers**, and
mints a short-lived token for the map image. **`/api/map?t=<token>`** renders a Mapbox **Static
Images** PNG of the route (token-gated, never the phone number — see Security). The image is sent
as WhatsApp/MMS `<Media>`; the dashboard decodes the same polyline to draw the real street route.

---

## 5. File-by-file

```
lib/
  matcher.ts        ⭐ eligibility filters + weighted Polaris Score (pure, now-injected, tested)
  orchestrator.ts   conversation state machine (location-first); handleInbound / handleLocation
  verify.ts         Ghost Bed Radar: outbound call, DTMF resolve, composeRoute (directions+map+plan)
  constraints.ts    deterministic EN/ES need extraction + crisis detection (tested)
  ai.ts             bilingual reply composer: askLocation, directions, plan, help, route copy
  backboard.ts      optional Backboard LLM enrichment (gated, with deterministic fallback)
  directions.ts     Mapbox Directions / Geocoding / Static map (token server-side)
  geo.ts            ZIP centroids, haversine distance, transit/drive ETA
  resources.ts      seed data: 13 shelters + 30 services (real SCC orgs; illustrative availability)
  store.ts          state: in-memory (globalThis, HMR-safe) → Upstash Redis when configured
  sms.ts            Twilio/Telnyx send + Twilio voice call (fetch, no SDK; graceful simulation)
  types.ts          domain types
app/
  page.tsx          landing            api/sms/             inbound webhook (3 sources)
  demo/page.tsx     phone simulator    api/verify/call|callback/  TwiML + DTMF result
  dashboard/page.tsx Live Sky map      api/dashboard/       read endpoint (2s poll)
  provider/page.tsx Provider Beacon    api/map/             token-gated route PNG
  privacy|terms|optin  A2P compliance  api/provider/update/ shelter self-update
components/
  LiveMap.tsx       Leaflet map: Mapbox Light tiles, house/user markers, real route polyline
  SiteNav.tsx       shared top bar     Donut.tsx / PolarisMark.tsx
```

---

## 6. The matcher (the defensible core) — `lib/matcher.ts`

Two clearly separated stages so each is easy to reason about and test:

1. **Hard eligibility filters** — a failed filter *removes* the resource. Sending a family to a
   men-only shelter, or a wheelchair user to a place with stairs, is worse than returning nothing.
   Filters: family capacity, gender policy, ADA, pets, has-space, open-for-intake-today.
2. **Weighted score (0–100)** —
   `0.30·proximity + 0.30·freshness + 0.15·availability + 0.25·reachability`.
   - **freshness** = exponential decay on time-since-verified (never-verified seed sits low, so it
     always wants re-verification before we route anyone there).
   - **reachability** collapses to ~0.1 for any option you *cannot* reach before intake closes —
     the exact "ghost trip" Polaris exists to prevent. Intake hours are evaluated in **Pacific time**
     regardless of server timezone.

The function is **pure** and takes `now` + an `origin` coordinate as arguments, so it's fully
unit-tested and deterministic. Every result carries human-readable `reasons[]`.

---

## 7. AI layer

- **Deterministic first** (`constraints.ts`, `ai.ts`): regex extraction + templated bilingual
  replies. Chosen on purpose — SMS copy to someone in crisis must be calm and predictable, and the
  live demo must never hang on a model call.
- **Backboard (sponsor) enrichment** (`backboard.ts`): only invoked when the deterministic pass
  comes back *thin* (an off-script phrasing). 4.5 s timeout; any failure silently falls back. So:
  better understanding when it helps, zero new failure modes when it doesn't.

---

## 8. State & storage — `lib/store.ts`

A small `AppState` (resources, conversations, verifications, impact). In-memory by default, pinned
on `globalThis` so it survives Next dev HMR; transparently upgrades to **Upstash Redis** when
`KV_REST_API_*` / `UPSTASH_*` env vars are present (so the same code works across serverless
instances on Vercel). `POST /api/reset` re-seeds for a clean demo.

---

## 9. Security & privacy

- **No PII by default** — people are keyed by phone and shown only as a star-name pseudonym.
- **Crisis → 988**, never a bot trying to counsel.
- **Token-gated map images** — `/api/map` requires an unguessable 24-byte token with a 10-minute
  TTL (minted server-side), so a vulnerable person's location can't be enumerated by phone number.
- **Mapbox token stays server-side** for Directions/Static; the public tile token is scoped to tiles.
- Known production hardening (documented, deferred for the event): Twilio/Telnyx webhook signature
  verification. The open JSON path is intentional — it powers the public `/demo` simulator.

---

## 10. Deploy & ops

- **Vercel** (`vercel --prod`). Env: Twilio creds + number, Mapbox token, Upstash Redis, Backboard
  key, `PUBLIC_BASE_URL`, `DEMO_SHELTER_PHONE`.
- **Telephony**: Twilio number with the SMS webhook → `/api/sms`; WhatsApp sandbox for A2P-free demos.
- **Tests**: `npm test` (31), `npm run typecheck`, `npm run build` — all green.
