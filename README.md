# Polaris

**Real-time shelter verification and routing. Polaris confirms a bed is actually open, by phone, before sending anyone across town.**

Built for Milpitas Hacks, Track 2 (Housing Dignity). Live demo: **https://mhs-navy.vercel.app**

![Polaris Live Sky dashboard](docs/screenshots/dashboard.png)

---

## Inspiration

Every night, thousands of people seeking shelter are routed using information that is already outdated. Beds listed as available often are not. Providers spend hours answering the same calls, while vulnerable individuals are sent across cities only to discover there is no space when they arrive.

We were inspired by a simple question:

> Why are we routing people using static information when housing availability changes in real time?

Polaris was built to bring real-time verification and visibility to emergency housing systems, helping ensure that every referral is backed by live data rather than assumptions.

## What it does

Polaris is an AI-powered housing verification and routing platform that helps providers and outreach teams find available shelter beds with confidence. By verifying before routing, Polaris reduces wasted referrals, provider burden, and failed placement attempts.

| Capability | What it means |
|---|---|
| Verifies availability | Places automated outreach (a phone call with a keypad question) to confirm a bed before routing |
| Kills "ghost beds" | Detects and prevents beds that appear available but are not, and counts each one avoided |
| SMS and voice intake | Receives housing requests by plain text or a phone call, no app or data plan required |
| Understands the person | Extracts needs such as urgency, family size, ADA accessibility, pets, and transportation |
| Smart matching | Ranks the most appropriate verified resource by eligibility, freshness, proximity, and reachability |
| Real directions | Sends a route map plus turn by turn directions to the confirmed location |
| Live operations map | Visualizes shelter status, people reaching out, and routing activity in real time |
| Bilingual and safe | Responds in English or Spanish, and routes crisis messages to 988 |

## How we built it

Polaris is a single Next.js application on Vercel, where API routes are the messaging and voice webhooks and the same codebase serves the operations dashboard.

| Concern | How we built it |
|---|---|
| Intake | Inbound SMS and WhatsApp arrive at a webhook; a deterministic extractor parses needs in English and Spanish, with an optional LLM layer (Backboard) that only fills gaps the rules miss |
| Location | We never ask for a ZIP. People share their location (native on WhatsApp) or type a cross street, which we geocode, then route from their real coordinate |
| Matching | A hand built engine applies hard eligibility filters, then a weighted score (proximity, freshness, availability, and reachability before intake closes), all unit tested |
| Verification | For any stale match, Polaris places a real outbound voice call; the provider answers one keypad question (press 1 for space, press 2 for full). DTMF keypad, not speech, so it is reliable live |
| Routing | On confirmation we send real street directions and a route map image, plus the nearest food and showers as a plan |
| Visibility | A live, map first operations dashboard plots shelters, people, and the actual routes between them, updating every two seconds |
| State | Shared real time state lives in Upstash Redis, with an in memory fallback for local development |

Our biggest design principle was that Polaris owns the routing logic (the part that must be correct), while AI only renders language and infrastructure stays as plumbing.

## Challenges we ran into

One of our biggest challenges was dealing with unreliable housing data. Most housing systems operate with delayed updates, fragmented databases, and manual communication. Building a system that could reliably determine whether a resource was truly available required designing verification workflows that worked even when providers were busy or unavailable.

We also had to balance automation with trust, ensuring that recommendations were explainable and backed by verified information rather than predictions alone.

A third challenge was carrier compliance: sending application to person SMS in the US requires A2P 10DLC registration, which is slow. We designed the system so the same backend runs over WhatsApp and a web simulator without that delay, and real SMS switches on automatically once registration clears.

## Accomplishments that we're proud of

- Built a fully functioning end to end prototype in a short timeframe
- Integrated real time SMS, WhatsApp, and voice communication
- Developed automated resource verification workflows
- Created an operational dashboard centered around live housing intelligence
- Designed a system specifically focused on eliminating ghost bed referrals
- Combined AI, mapping, and communications infrastructure into a unified platform

## What we learned

We learned that the housing crisis is not only a resource problem, but also an information problem. Providers often have resources available, but the information needed to connect people with those resources is fragmented, outdated, or inaccessible at the moment decisions are made.

We also learned that small improvements in operational visibility can create significant real world impact.

## What's next for Polaris

- Expanding provider integrations
- Building predictive availability forecasting
- Creating municipal and county level deployments
- Supporting coordinated entry systems
- Adding more multilingual communication capabilities
- Developing analytics for policymakers and housing agencies
- Scaling beyond shelters to transitional housing, food assistance, and other critical social services

## Built with

| Category | Technologies |
|---|---|
| Languages | TypeScript |
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4 |
| Messaging and voice | Twilio (SMS, WhatsApp, Voice with TwiML and DTMF), Telnyx |
| Maps and geo | Mapbox (Directions, Static Images, Geocoding), Leaflet, react-leaflet |
| AI | Backboard (LLM enrichment), deterministic NLU |
| Database and state | Upstash Redis |
| Hosting | Vercel |
| Testing | Vitest |

**Tags:** typescript, next.js, react, tailwindcss, twilio, telnyx, mapbox, leaflet, backboard, upstash, redis, vercel, vitest

---

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests
```

With no environment variables set, Polaris runs on an in memory store and simulates sends, so you can drive the full flow without any accounts. See `.env.example` for live messaging, maps, and storage configuration, and `docs/ARCHITECTURE.md` for a full technical rundown.

*Resource availability shown is illustrative seed data for demonstration; Polaris verifies live before routing anyone. Real Santa Clara County organizations are referenced for relevance.*
