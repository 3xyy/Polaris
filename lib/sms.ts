// Thin Twilio REST client over fetch — no SDK. Two verbs are all Polaris needs: send an SMS,
// and place an outbound voice call that points at our TwiML. Kept transparent on purpose so it
// can be read top-to-bottom in code review, and so missing credentials degrade gracefully
// (locally, without Twilio env vars, sends are logged instead of throwing).

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM_NUMBER;

export function twilioConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/** Public origin Twilio can reach to fetch TwiML / hit our callbacks. */
export function baseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
}

export interface TwilioResult {
  ok: boolean;
  sid?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendSms(to: string, body: string): Promise<TwilioResult> {
  if (!twilioConfigured()) {
    console.log(`[sms:simulated] -> ${to}: ${body}`);
    return { ok: true, simulated: true };
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: FROM!, Body: body }),
    },
  );
  const data = (await res.json()) as { sid?: string; message?: string };
  return res.ok
    ? { ok: true, sid: data.sid }
    : { ok: false, error: data.message ?? `Twilio ${res.status}` };
}

/** Place an outbound call; Twilio fetches `twimlUrl` to learn what to say / gather. */
export async function placeCall(to: string, twimlUrl: string): Promise<TwilioResult> {
  if (!twilioConfigured()) {
    console.log(`[call:simulated] -> ${to} via ${twimlUrl}`);
    return { ok: true, simulated: true };
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: FROM!,
        Url: twimlUrl,
        Method: "POST",
        Timeout: "20",
      }),
    },
  );
  const data = (await res.json()) as { sid?: string; message?: string };
  return res.ok
    ? { ok: true, sid: data.sid }
    : { ok: false, error: data.message ?? `Twilio ${res.status}` };
}
