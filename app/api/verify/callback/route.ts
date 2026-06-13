import { resolveVerification } from "@/lib/verify";

// The provider's keypad press (or a no-input timeout) lands here. We resolve the verification
// — which updates state and texts the user the outcome — then say goodbye and hang up.

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const vid = url.searchParams.get("vid") ?? "";
  // Digits come from Twilio's form post; also accept ?Digits= for local manual testing.
  let digits: string | null = url.searchParams.get("Digits");
  if (!digits) {
    try {
      const form = await req.formData();
      const d = form.get("Digits");
      digits = d ? d.toString() : null;
    } catch {
      digits = null;
    }
  }

  const message = await resolveVerification(vid, digits);

  // The web simulator calls this with ?format=json to render the outcome in the chat.
  if (url.searchParams.get("format") === "json") {
    return Response.json({ ok: true, message });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say voice="Polly.Joanna">Thank you. Goodbye.</Say><Hangup/></Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = handle;
export const POST = handle;
