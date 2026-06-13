import { baseUrl } from "@/lib/sms";
import { getResource, getVerification } from "@/lib/store";

// TwiML Twilio fetches when the verification call connects: ask one keypad question.
// DTMF (digits), not speech recognition — reliable enough to run live in front of judges.

export const dynamic = "force-dynamic";

async function twiml(req: Request): Promise<Response> {
  const vid = new URL(req.url).searchParams.get("vid") ?? "";
  const v = await getVerification(vid);
  const r = v ? await getResource(v.resourceId) : undefined;
  const beds = v?.bedsNeeded ?? 1;
  const who = beds > 1 ? `a family of ${beds}` : "one person";
  const name = r?.name ?? "your shelter";
  const action = `${baseUrl()}/api/verify/callback?vid=${encodeURIComponent(vid)}`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Gather numDigits="1" action="${action}" method="POST" timeout="10">` +
    `<Say voice="Polly.Joanna">Hello, this is Polaris, a housing navigator, verifying bed availability for ${name}. ` +
    `Do you have space tonight for ${who}? Press 1 for yes. Press 2 for no.</Say>` +
    `</Gather>` +
    `<Redirect method="POST">${action}&amp;timeout=1</Redirect>` +
    `</Response>`;

  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = twiml;
export const POST = twiml;
