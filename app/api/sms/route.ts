import { handleInbound } from "@/lib/orchestrator";

// Twilio inbound SMS webhook. Also accepts JSON ({ from, body }) so it doubles as a test
// harness during development. Responds with TwiML so the immediate reply(s) go back as SMS;
// any async follow-up (the verification confirmation) is sent separately via the REST client.

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  let from = "";
  let body = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as { from?: string; body?: string };
    from = json.from ?? "";
    body = json.body ?? "";
  } else {
    const form = await req.formData();
    from = (form.get("From") ?? "").toString();
    body = (form.get("Body") ?? "").toString();
  }

  if (!from || !body) {
    return new Response("Missing From/Body", { status: 400 });
  }

  const result = await handleInbound({ from, body });

  // JSON callers (tests / tooling) get structured data back.
  if (contentType.includes("application/json")) {
    return Response.json(result);
  }

  const messages = result.replies.map((r) => `<Message>${escapeXml(r)}</Message>`).join("");
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>${messages}</Response>`;
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
