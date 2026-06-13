import type { Conversation, Resource, Verification } from "./types";
import { baseUrl, placeCall, sendSms } from "./sms";
import {
  addVerification,
  bumpImpact,
  getResource,
  getResources,
  getVerification,
  updateResource,
  updateVerification,
  upsertConversation,
  getConversation,
} from "./store";
import { bedsNeededFor, rankResources } from "./matcher";
import { fullFallback, routeReply } from "./ai";

/**
 * The Ghost Bed Radar engine.
 *
 * A "ghost bed" is a listing that says open but is actually full. Polaris refuses to route
 * someone to an unverified bed: it places a real outbound call to the provider, which answers
 * a single keypad question (press 1 = space, 2 = full). DTMF — not speech — so it is reliable
 * live. The result updates the resource's freshness and either confirms the route or fails
 * over to the next option, and is recorded as a ghost bed avoided / verified route.
 */

let counter = 0;
function vid(): string {
  counter += 1;
  return `v${Date.now().toString(36)}${counter}`;
}

/** Kick off a verification call for the chosen resource on behalf of a conversation. */
export async function beginVerification(
  resource: Resource,
  conversation: Conversation,
): Promise<Verification> {
  const beds = bedsNeededFor(conversation.constraints);
  const verification: Verification = {
    id: vid(),
    resourceId: resource.id,
    resourceName: resource.name,
    conversationId: conversation.id,
    status: "calling",
    bedsNeeded: beds,
    requestedAt: Date.now(),
    respondedAt: null,
    openBedsReported: null,
  };
  await addVerification(verification);

  // In trial/demo mode we call a single pre-verified phone instead of the real intake line.
  const target = process.env.DEMO_SHELTER_PHONE || resource.phone;
  const twimlUrl = `${baseUrl()}/api/verify/call?vid=${verification.id}`;
  await placeCall(target, twimlUrl);

  return verification;
}

/**
 * Handle the provider's keypad response (or a timeout). Updates state, then sends the user the
 * outcome over SMS — the async second half of the conversation.
 */
export async function resolveVerification(
  verificationId: string,
  digit: string | null,
): Promise<void> {
  const v = await getVerification(verificationId);
  if (!v || v.status !== "calling") return; // already resolved or unknown

  const resource = await getResource(v.resourceId);
  const conversation = await getConversation(v.conversationId);
  if (!resource || !conversation) return;
  const now = Date.now();

  if (digit === "1") {
    // Confirmed — freshen the resource and route the person there.
    await updateResource(resource.id, {
      lastVerifiedAt: now,
      verifyMethod: "phone",
      openBeds: Math.max(resource.openBeds, v.bedsNeeded),
    });
    await updateVerification(v.id, {
      status: "confirmed",
      respondedAt: now,
      openBedsReported: resource.openBeds,
    });
    await bumpImpact({ verifiedRoutes: 1 });
    await setConvStatus(conversation, "routed");

    const fresh = await getResource(resource.id);
    const match = (await rankResources(conversation.constraints, await getResources(), new Date()))
      .find((m) => m.resource.id === resource.id);
    const secs = Math.max(1, Math.round((now - v.requestedAt) / 1000));
    const body = match
      ? routeReply(match, conversation.constraints, conversation.lang, { justConfirmedSeconds: secs })
      : `✅ ${fresh?.name} confirmed space — head there now.`;
    await sendSms(conversation.id, body);
    return;
  }

  if (digit === "2") {
    // Full — the ghost bed we just prevented. Update and fail over to the next option.
    await updateResource(resource.id, {
      lastVerifiedAt: now,
      verifyMethod: "phone",
      openBeds: 0,
    });
    await updateVerification(v.id, { status: "full", respondedAt: now, openBedsReported: 0 });
    await bumpImpact({ ghostBedsAvoided: 1 });
    await setConvStatus(conversation, "matching");

    const next = (await rankResources(conversation.constraints, await getResources(), new Date()))
      .find((m) => m.resource.id !== resource.id);
    await sendSms(conversation.id, fullFallback(next?.resource.name ?? null, conversation.lang));
    return;
  }

  // No answer / timeout.
  await updateVerification(v.id, { status: "no_answer", respondedAt: now });
  await setConvStatus(conversation, "matching");
  await sendSms(
    conversation.id,
    conversation.lang === "es"
      ? `No contestaron en ${resource.name}. No te mando sin confirmar. Sigo intentando con otra opción.`
      : `No answer at ${resource.name}. I won't send you without confirming — let me try another option.`,
  );
}

async function setConvStatus(conv: Conversation, status: Conversation["status"]): Promise<void> {
  await upsertConversation({ ...conv, status, updatedAt: Date.now() });
}
