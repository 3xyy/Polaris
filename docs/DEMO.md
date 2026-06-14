# Polaris — Judge Run Sheet (5 minutes)

**One-liner:** *Polaris kills ghost beds — it calls the shelter to confirm a real bed before sending someone across town, all over a plain text or phone call.*

## Setup (before you're called up)
- Projector / screen → **`mhs-navy.vercel.app/dashboard`** (full-screen Live Sky).
- **Phone A** = the person (WhatsApp to the sandbox number, or SMS to your Twilio number).
- **Phone B** = the shelter (receives the verify call → presses 1/2). *(Set `DEMO_SHELTER_PHONE` to this number.)*
- Open **`/demo`** in a tab as an instant fallback. Hit **Reset demo** right before you start.
- Roles: **A — narrator** (talks, drives the dashboard). **B — the person** (texts) + holds Phone B.

---

## Presentation + live demo (~3.5 min)

**[0:00–0:25] Hook**
> "Picture being homeless with no smartphone. A shelter list says a bed is open, so you take a
> two-hour bus across town — and it's full. The bed you *didn't* go to is gone too. These are
> **ghost beds**, and they happen every night. Polaris kills them."

**[0:25–0:50] What it is**
> "Polaris works over plain **text or a phone call** — no app, no data, no smartphone. It
> understands your situation, finds eligible shelters, and — the key part — **calls the shelter to
> confirm a real bed before sending you anywhere.**"

**[0:50–3:00] Live demo** *(narrate the dashboard the whole time)*
1. Phone A texts: **"need a bed tonight, my 2 kids, no car."** → *"It read the real need — family,
   no car, tonight — and it asks where I am."*
2. Phone A taps **📎 → Location → Send** (or types an address). → Dashboard: a new **signal**
   appears, the **Need Compass** fills, status flips to **verifying**.
3. *"It won't trust the list — watch, it's calling the shelter."* The **Ghost Bed Radar** shows
   **Calling…**, and **Phone B rings.** B answers, **presses 1.**
4. Phone A gets **"✅ Confirmed" + a route map + turn-by-turn + nearby food & showers.** Dashboard:
   the **real street route** draws from the person to the shelter, **Trust Score → 100.**
5. **The money beat:** run it once more, **press 2** → *"That one was full — this is exactly why we
   verify."* **Ghost beds avoided** ticks up. That single counter is the whole thesis.

**[3:00–3:30] Breadth + impact (fast)**
> "It's bilingual — text it in Spanish. It routes crisis messages to 988, not a bot. It stores no
> personal info. Shelters keep it fresh by texting `3 OPEN`. And it runs on a $20 flip phone —
> which is exactly who needs it." *(Optionally: text `FOOD` → nearest pantries appear.)*

---

## Q&A — likely questions + answers (~1.5 min)

- **"Is the verification real?"** → "Yes — a real outbound phone call with a keypad confirmation.
  In production it dials the shelter's intake line; for the demo a teammate plays the shelter."
- **"Isn't this just ChatGPT / API calls?"** → "The AI only reads the message and writes the reply.
  The routing — eligibility filters plus a weighted score with a *reachability* term that rejects
  anything you can't reach before intake closes — is our own code, with 31 tests. Happy to show it."
- **"How do you get someone's location over SMS?"** → "We can't from a raw SMS — so on WhatsApp we
  use native location share, and on SMS we geocode a cross-street they type. Then we route from
  their real position on real streets via Mapbox."
- **"How does it scale / is it real?"** → "Stateless on Vercel + Redis; it's deployed and live now.
  Shelters self-update by texting `FULL`/`3 OPEN`; the matcher is O(n) over a county's resources."
- **"Why not an app or a map website?"** → "The people most in need don't have smartphones or data.
  SMS + voice *is* the accessibility thesis — that's the 'dignity' in Housing Dignity."
- **"What about privacy / safety?"** → "No legal name or SSN — people are shown as a star name. The
  route-map link is an unguessable token, not a phone number, so locations can't be enumerated.
  Self-harm language stops matching and routes to 988."
- **"What's the business model / who pays?"** → "Counties and continuums of care already fund 2-1-1
  and HMIS; Polaris is the verification + routing layer on top, billed per placement or per seat."
- **"What was hardest?"** → "Making the live verification bulletproof — DTMF keypad instead of
  speech — and keeping the whole thing working on a phone with no data."

## If something lags in the room
Switch to the **`/demo`** tab (same backend, press-1/press-2 buttons) and keep narrating — zero dead air.
