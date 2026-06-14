import { handleInbound, handleLocation } from "@/lib/orchestrator";
import { sendSms } from "@/lib/sms";

// Inbound message webhook. Handles three sources (Twilio form, Telnyx JSON, JSON test harness)
// and two payload kinds (a text message, or a shared location → directions + map).

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(replies: string[], mediaUrl?: string): Response {
  const messages = replies
    .map((r, i) => {
      const media = i === 0 && mediaUrl ? `<Media>${escapeXml(mediaUrl)}</Media>` : "";
      return `<Message><Body>${escapeXml(r)}</Body>${media}</Message>`;
    })
    .join("");
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
      lat?: number;
      lng?: number;
      data?: { event_type?: string; payload?: { from?: { phone_number?: string }; text?: string; direction?: string } };
    };

    // Telnyx webhook
    if (json.data?.event_type) {
      if (json.data.event_type !== "message.received" || json.data.payload?.direction !== "inbound") {
        return new Response("", { status: 200 });
      }
      const from = json.data.payload?.from?.phone_number ?? "";
      const body = json.data.payload?.text ?? "";
      if (from && body) {
        const result = await handleInbound({ from, body });
        for (const r of result.replies) await sendSms(from, r);
      }
      return new Response("", { status: 200 });
    }

    // JSON test harness — shared location
    if (json.from && typeof json.lat === "number" && typeof json.lng === "number") {
      return Response.json(await handleLocation({ from: json.from, lat: json.lat, lng: json.lng }));
    }
    // JSON test harness — message
    if (json.from && json.body) {
      return Response.json(await handleInbound({ from: json.from, body: json.body }));
    }
    return new Response("Missing from/body", { status: 400 });
  }

  // Twilio form-encoded
  const form = await req.formData();
  const from = (form.get("From") ?? "").toString();

  // WhatsApp/MMS native location share
  const lat = form.get("Latitude");
  const lng = form.get("Longitude");
  if (from && lat && lng) {
    const result = await handleLocation({ from, lat: parseFloat(lat.toString()), lng: parseFloat(lng.toString()) });
    return twiml(result.replies, result.mediaUrl);
  }

  const body = (form.get("Body") ?? "").toString();
  if (!from || !body) return new Response("Missing From/Body", { status: 400 });
  const result = await handleInbound({ from, body });
  return twiml(result.replies);
}
