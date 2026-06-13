import type { Constraints } from "./types";

/**
 * Optional Backboard LLM enrichment (https://docs.backboard.io).
 *
 * Backboard is the event sponsor's unified AI API: POST /threads/messages with an X-API-Key
 * header. We use it to ENRICH constraint extraction — catching free-form phrasings the
 * deterministic regexes miss — while the deterministic extractor stays authoritative and the
 * replies stay template-based. So: better understanding when the key is present, zero new
 * failure modes when it isn't (or when the call is slow/down — we time out and fall back).
 */

const API_KEY = process.env.BACKBOARD_API_KEY;
const BASE_URL = process.env.BACKBOARD_BASE_URL || "https://app.backboard.io/api";
const PROVIDER = process.env.BACKBOARD_PROVIDER || "openai";
const MODEL = process.env.BACKBOARD_MODEL || "gpt-4o-mini";
const TIMEOUT_MS = 4500;

export function backboardEnabled(): boolean {
  return Boolean(API_KEY);
}

const EXTRACTION_PROMPT = `You extract housing-intake fields from a person's text message. Return ONLY compact JSON (no prose, no markdown) containing the keys you can confidently determine, omitting any you cannot:
- zip: string (5 digits)
- urgency: "tonight" | "soon" | "flexible"
- family: boolean
- childrenCount: number
- bedsNeeded: number
- gender: "woman" | "man" | "nonbinary"
- ada: boolean (uses a wheelchair / needs accessibility)
- pets: boolean
- noCar: boolean (no car / relies on transit or walking)
Message: `;

/** Pull the first JSON object out of a model response and whitelist it to valid Constraints. */
export function parseConstraintsJson(text: string): Partial<Constraints> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<Constraints> = {};

  if (typeof o.zip === "string" && /^\d{5}$/.test(o.zip)) out.zip = o.zip;
  if (o.urgency === "tonight" || o.urgency === "soon" || o.urgency === "flexible") out.urgency = o.urgency;
  if (typeof o.family === "boolean") out.family = o.family;
  if (typeof o.childrenCount === "number" && o.childrenCount >= 0) out.childrenCount = o.childrenCount;
  if (typeof o.bedsNeeded === "number" && o.bedsNeeded > 0) out.bedsNeeded = o.bedsNeeded;
  if (o.gender === "woman" || o.gender === "man" || o.gender === "nonbinary") out.gender = o.gender;
  if (typeof o.ada === "boolean") out.ada = o.ada;
  if (typeof o.pets === "boolean") out.pets = o.pets;
  if (typeof o.noCar === "boolean") out.noCar = o.noCar;

  return out;
}

/** Ask Backboard to extract constraints. Returns null on any error/timeout — caller falls back. */
export async function enrichConstraints(message: string): Promise<Partial<Constraints> | null> {
  if (!API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/threads/messages`, {
      method: "POST",
      headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: EXTRACTION_PROMPT + JSON.stringify(message),
        llm_provider: PROVIDER,
        model_name: MODEL,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    return data.content ? parseConstraintsJson(data.content) : null;
  } catch {
    return null; // network error, timeout, or bad JSON — deterministic path stands
  } finally {
    clearTimeout(timer);
  }
}
