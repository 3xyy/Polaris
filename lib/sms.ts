// Messaging + voice clients over fetch — no SDKs. Two providers are supported for SMS so we
// can hedge A2P 10DLC approval: Telnyx (preferred when configured) and Twilio. Voice (the
// verification call) always uses Twilio. Missing credentials degrade gracefully to logged
// "simulated" sends so local dev never throws.

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM_NUMBER;

const TELNYX_KEY = process.env.TELNYX_API_KEY;
const TELNYX_FROM = process.env.TELNYX_FROM_NUMBER;
const TELNYX_PROFILE = process.env.TELNYX_MESSAGING_PROFILE_ID;

// Twilio's shared WhatsApp sandbox number (same for all accounts). Override via env if needed.
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export function twilioConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

export function telnyxConfigured(): boolean {
  return Boolean(TELNYX_KEY && TELNYX_FROM);
}

/** Public origin Twilio/Telnyx can reach to fetch TwiML / hit our callbacks. */
export function baseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function twilioAuth(): string {
  return "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
}

export interface SendResult {
  ok: boolean;
  sid?: string;
  error?: string;
  simulated?: boolean;
  provider?: "telnyx" | "twilio";
}

/**
 * Send an SMS. Plain SMS prefers Telnyx when configured (provider hedge); WhatsApp addresses
 * always go through Twilio. Falls back to Twilio, then to a logged simulation.
 */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const isWhatsApp = to.startsWith("whatsapp:");
  if (!isWhatsApp && telnyxConfigured()) return sendViaTelnyx(to, body);
  if (twilioConfigured()) return sendViaTwilio(to, body, isWhatsApp);
  console.log(`[sms:simulated] -> ${to}: ${body}`);
  return { ok: true, simulated: true };
}

async function sendViaTelnyx(to: string, body: string): Promise<SendResult> {
  const payload: Record<string, string> = { from: TELNYX_FROM!, to, text: body };
  if (TELNYX_PROFILE) payload.messaging_profile_id = TELNYX_PROFILE;
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${TELNYX_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: unknown;
  };
  return res.ok
    ? { ok: true, sid: data.data?.id, provider: "telnyx" }
    : { ok: false, error: JSON.stringify(data.errors ?? data), provider: "telnyx" };
}

async function sendViaTwilio(to: string, body: string, isWhatsApp: boolean): Promise<SendResult> {
  const from = isWhatsApp ? WHATSAPP_FROM : FROM!;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  const data = (await res.json()) as { sid?: string; message?: string };
  return res.ok
    ? { ok: true, sid: data.sid, provider: "twilio" }
    : { ok: false, error: data.message ?? `Twilio ${res.status}`, provider: "twilio" };
}

/** Place an outbound voice call (always Twilio); Twilio fetches `twimlUrl` for instructions. */
export async function placeCall(to: string, twimlUrl: string): Promise<SendResult> {
  if (!twilioConfigured()) {
    console.log(`[call:simulated] -> ${to} via ${twimlUrl}`);
    return { ok: true, simulated: true };
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`,
    {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: FROM!, Url: twimlUrl, Method: "POST", Timeout: "20" }),
    },
  );
  const data = (await res.json()) as { sid?: string; message?: string };
  return res.ok
    ? { ok: true, sid: data.sid, provider: "twilio" }
    : { ok: false, error: data.message ?? `Twilio ${res.status}`, provider: "twilio" };
}
