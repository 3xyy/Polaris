import type { Conversation } from "./types";
import { extractConstraints, isCrisis, mergeConstraints } from "./constraints";
import { rankResources } from "./matcher";
import { getConversation, getResources, upsertConversation, bumpImpact, getResource } from "./store";
import { beginVerification } from "./verify";
import {
  askZip,
  callAhead,
  crisisReply,
  detectLang,
  noMatch,
  routeReply,
  verifying,
} from "./ai";

/**
 * The conversation state machine. This is the part Polaris owns end-to-end: it decides when to
 * ask for a ZIP, when a candidate is too stale to trust, and when to pick up the phone. The AI
 * layer only renders language; the routing decisions live here, in plain, auditable logic.
 */

// Below this confidence, we will not route someone without a live phone re-confirmation.
const VERIFY_THRESHOLD = 0.7;

const STAR_NAMES = [
  "Vega", "Lyra", "Orion", "Mira", "Rigel", "Atlas", "Nova", "Caelum",
  "Sirius", "Polaris", "Altair", "Carina", "Phoenix", "Cassia", "Leo",
];

function pseudonymFor(phone: string): string {
  let h = 0;
  for (const ch of phone) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return `${STAR_NAMES[h % STAR_NAMES.length]}-${(h % 900) + 100}`;
}

export interface InboundResult {
  replies: string[];
  conversation: Conversation;
  verificationStarted: boolean;
}

export async function handleInbound(args: {
  from: string;
  body: string;
  channel?: "sms" | "voice";
}): Promise<InboundResult> {
  const { from, body, channel = "sms" } = args;
  const now = Date.now();
  const lang = detectLang(body);

  let conv = await getConversation(from);
  if (!conv) {
    conv = {
      id: from,
      pseudonym: pseudonymFor(from),
      channel,
      lang,
      constraints: {},
      lastMessage: body,
      lastReplies: [],
      topMatchId: null,
      status: "intake",
      createdAt: now,
      updatedAt: now,
    };
  }
  conv = { ...conv, lang, lastMessage: body, updatedAt: now };

  // 1) Safety first — crisis short-circuits everything.
  if (isCrisis(body)) {
    const reply = crisisReply(lang);
    await finalize(conv, "crisis", [reply]);
    return { replies: [reply], conversation: conv, verificationStarted: false };
  }

  // 2) Quick-reply commands.
  const cmd = body.trim().toUpperCase();
  if ((cmd === "CALL" || cmd === "LLAMAR") && conv.topMatchId) {
    const r = await getResource(conv.topMatchId);
    if (r) {
      const reply = callAhead(r.name, r.phone, conv.constraints, lang);
      await finalize(conv, "routed", [reply]);
      return { replies: [reply], conversation: conv, verificationStarted: false };
    }
  }
  if (cmd === "YES" || cmd === "SI" || cmd === "SÍ") {
    const ranked = rankResources(conv.constraints, await getResources(), new Date());
    if (ranked.length > 0) {
      const top = ranked[0];
      conv = { ...conv, topMatchId: top.resource.id };
      await beginVerification(top.resource, conv);
      const reply = verifying(top.resource.name, lang);
      await finalize(conv, "verifying", [reply]);
      return { replies: [reply], conversation: conv, verificationStarted: true };
    }
  }

  // 3) Understand the need.
  const extracted = extractConstraints(body);
  conv = { ...conv, constraints: mergeConstraints(conv.constraints, extracted) };

  // 4) Need a ZIP before we can rank by proximity.
  if (!conv.constraints.zip) {
    const reply = askZip(conv.constraints, lang);
    await finalize(conv, "intake", [reply]);
    return { replies: [reply], conversation: conv, verificationStarted: false };
  }

  // 5) Rank eligible resources.
  const ranked = rankResources(conv.constraints, await getResources(), new Date());
  if (ranked.length === 0) {
    const reply = noMatch(lang);
    await finalize(conv, "routed", [reply]);
    return { replies: [reply], conversation: conv, verificationStarted: false };
  }

  const top = ranked[0];
  conv = { ...conv, topMatchId: top.resource.id };

  // 6) The core decision: trust it, or verify it live first.
  if (top.confidence < VERIFY_THRESHOLD) {
    await beginVerification(top.resource, conv);
    const reply = verifying(top.resource.name, lang);
    await finalize(conv, "verifying", [reply]);
    return { replies: [reply], conversation: conv, verificationStarted: true };
  }

  // 7) Already fresh — route immediately.
  const minutesAgo = top.resource.lastVerifiedAt
    ? Math.max(1, Math.round((now - top.resource.lastVerifiedAt) / 60_000))
    : 0;
  const reply = routeReply(top, conv.constraints, lang, { verifiedMinutesAgo: minutesAgo });
  await bumpImpact({ verifiedRoutes: 1 });
  await finalize(conv, "routed", [reply]);
  return { replies: [reply], conversation: conv, verificationStarted: false };
}

async function finalize(
  conv: Conversation,
  status: Conversation["status"],
  replies: string[],
): Promise<void> {
  await upsertConversation({ ...conv, status, lastReplies: replies, updatedAt: Date.now() });
}
