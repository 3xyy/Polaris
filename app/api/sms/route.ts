import { handleInbound } from "@/lib/orchestrator";
import { sendSms } from "@/lib/sms";

// Inbound message webhook. Handles three sources:
//   - Twilio  (form-encoded; reply via TwiML in the response)
//   - Telnyx  (JSON webhook; reply by sending via the API, return 200)
//   - JSON test harness ({ from, body }; returns structured data)

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(replies: string[]): Response {
  const messages = replies.map((r) => `<Message>${escapeXml(r)}</Message>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${messages}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = (await req.json().catch(() => ({}))) as {
      from?: string;
      body?: string;
      data?: { event_type?: string; payload?: { from?: { phone_number?: string }; text?: string; direction?: string } };
    };

    // --- Telnyx webhook ---
    if (json.data?.event_type) {
      // Telnyx posts delivery receipts (message.sent/finalized) to the same URL — ignore them
      // to avoid treating our own outbound as inbound (which would loop).
      if (json.data.event_type !== "message.received" || json.data.payload?.direction !== "inbound") {
        return new Response("", { status: 200 });
      }
      const from = json.data.payload?.from?.phone_number ?? "";
      const body = json.data.payload?.text ?? "";
      if (from && body) {
        const result = await handleInbound({ from, body });
        // No synchronous reply channel — send each reply via the API.
        for (const r of result.replies) await sendSms(from, r);
      }
      return new Response("", { status: 200 });
    }

    // --- JSON test harness ---
    if (json.from && json.body) {
      const result = await handleInbound({ from: json.from, body: json.body });
      return Response.json(result);
    }
    return new Response("Missing from/body", { status: 400 });
  }

  // --- Twilio form-encoded ---
  const form = await req.formData();
  const from = (form.get("From") ?? "").toString();
  const body = (form.get("Body") ?? "").toString();
  if (!from || !body) return new Response("Missing From/Body", { status: 400 });
  const result = await handleInbound({ from, body });
  return twiml(result.replies);
}
