import type { Constraints, MatchResult } from "./types";
import type { Directions } from "./directions";
import { formatClock } from "./matcher";

/**
 * Reply composition. Deliberately deterministic and template-based: SMS copy for someone in
 * crisis must be calm, short, and predictable — never a surprise from a model. Bilingual
 * EN/ES out of the box (Santa Clara County is ~50% Spanish-speaking households in some ZIPs).
 * An LLM layer can later paraphrase/translate further, but these templates are the floor.
 */

export type Lang = "en" | "es";

const ES_SIGNALS =
  /\b(necesito|dormir|noche|hijos?|ni[ñn]os?|sin|carro|coche|ayuda|hoy|familia|por favor|cama|refugio)\b/i;

export function detectLang(message: string): Lang {
  return ES_SIGNALS.test(message) ? "es" : "en";
}

function childPhrase(c: Constraints, lang: Lang): string {
  const beds = c.bedsNeeded ?? 1 + (c.childrenCount ?? 0);
  const kids = c.childrenCount ?? 0;
  const isFamily = !!(c.family || kids);

  if (!isFamily) return lang === "es" ? `para ${beds}` : `for ${beds}`;

  // Family with a known number of children -> spell out adults + children.
  if (kids > 0) {
    const adults = Math.max(1, beds - kids);
    if (lang === "es") {
      return `para ${adults} adulto${adults === 1 ? "" : "s"} + ${kids} ni${kids === 1 ? "ño" : "ños"}`;
    }
    return `for ${adults} adult${adults === 1 ? "" : "s"} + ${kids} child${kids === 1 ? "" : "ren"}`;
  }

  // Family of an unspecified makeup -> "a family of N".
  return lang === "es" ? `para una familia de ${beds}` : `for a family of ${beds}`;
}

export function askZip(c: Constraints, lang: Lang): string {
  const needs: string[] = [];
  if (c.urgency === "tonight") needs.push(lang === "es" ? "un lugar para esta noche" : "a place for tonight");
  if (c.family) needs.push(lang === "es" ? "para tu familia" : "for your family");
  const lead =
    needs.length > 0
      ? lang === "es"
        ? `Entendido — buscando ${needs.join(" ")}. `
        : `Got it — looking for ${needs.join(" ")}. `
      : lang === "es"
        ? "Estoy aquí para ayudar. "
        : "I'm here to help. ";
  return (
    lead +
    (lang === "es"
      ? "¿Cuál es tu código postal para encontrar lo más cercano?"
      : "What ZIP are you near so I can find the closest options?")
  );
}

export function askLocation(c: Constraints, lang: Lang): string {
  const needs: string[] = [];
  if (c.urgency === "tonight") needs.push(lang === "es" ? "un lugar para esta noche" : "a place for tonight");
  if (c.family) needs.push(lang === "es" ? "para tu familia" : "for your family");
  const lead =
    needs.length > 0
      ? lang === "es"
        ? `Entendido — buscando ${needs.join(" ")}. `
        : `Got it — looking for ${needs.join(" ")}. `
      : lang === "es"
        ? "Estoy aquí para ayudar. "
        : "I'm here to help. ";
  return (
    lead +
    (lang === "es"
      ? "Comparte tu ubicación 📍 (toca 📎 → Ubicación) o escribe tu dirección o cruce de calles más cercano."
      : "Share your location 📍 (tap 📎 → Location) or type your address or nearest cross-street.")
  );
}

export function helpReply(lang: Lang): string {
  return lang === "es"
    ? "Polaris encuentra refugio verificado, comida, duchas y más — por mensaje, desde cualquier teléfono.\n• Dime qué necesitas (ej. “cama esta noche, 2 niños”)\n• Comparte tu ubicación 📍 para direcciones\n• COMIDA — comida gratis cerca\n• DUCHA — duchas cerca\n• LLAMAR — te conecto con el lugar\n• 988 — apoyo en crisis 24/7\n• ALTO — cancelar"
    : "Polaris finds verified shelter, food, showers & more — by text, from any phone.\n• Tell me what you need (e.g. “bed tonight, 2 kids”)\n• Share your location 📍 for directions\n• FOOD — free food near you\n• SHOWER — showers near you\n• CALL — I'll connect you to the place\n• 988 — 24/7 crisis support\n• STOP — opt out";
}

export function planExtras(items: { icon: string; name: string; distanceMi: number }[], lang: Lang): string {
  if (!items.length) return "";
  const head = lang === "es" ? "\n\nTambién cerca de ti:" : "\n\nAlso near you:";
  return head + "\n" + items.map((it) => `${it.icon} ${it.name} (${it.distanceMi} mi)`).join("\n");
}

export function nearbyList(label: string, items: { name: string; distanceMi: number; address: string }[], lang: Lang): string {
  if (!items.length) return lang === "es" ? `No encontré ${label} cerca ahora mismo.` : `I couldn't find ${label} nearby right now.`;
  const head = lang === "es" ? `${label} cerca de ti:` : `${label} near you:`;
  return head + "\n" + items.map((it) => `• ${it.name} — ${it.distanceMi} mi (${it.address})`).join("\n");
}

export function verifying(resourceName: string, lang: Lang): string {
  return lang === "es"
    ? `Revisando ${resourceName} ahora mismo — confirmo que de verdad tienen espacio antes de mandarte. Un momento…`
    : `Checking ${resourceName} right now — I verify they actually have space before sending you anywhere. One moment…`;
}

interface RouteOpts {
  justConfirmedSeconds?: number; // set when freshly confirmed by phone
  verifiedMinutesAgo?: number; // set when already-fresh
}

export function routeReply(
  match: MatchResult,
  c: Constraints,
  lang: Lang,
  opts: RouteOpts = {},
): string {
  const r = match.resource;
  const who = childPhrase(c, lang);
  const cutoff = match.minutesToClose != null
    ? formatClock(cutoffStrFromReasons(match) ?? "")
    : "";
  const mode = c.noCar ? (lang === "es" ? "transporte" : "transit") : (lang === "es" ? "auto" : "car");

  let stamp: string;
  if (opts.justConfirmedSeconds != null) {
    stamp = lang === "es"
      ? `✅ Confirmado hace ${opts.justConfirmedSeconds}s:`
      : `✅ Confirmed ${opts.justConfirmedSeconds}s ago:`;
  } else {
    const m = opts.verifiedMinutesAgo ?? 0;
    stamp = lang === "es" ? `✅ Verificado hace ${m} min:` : `✅ Verified ${m} min ago:`;
  }

  const space = lang === "es" ? `tiene espacio esta noche ${who}` : `has space tonight ${who}`;
  const intake =
    cutoff && lang === "es"
      ? ` La admisión cierra a las ${cutoff}.`
      : cutoff
        ? ` Intake closes ${cutoff}.`
        : "";
  const travel = match.etaMin != null ? ` ~${match.etaMin} min ${lang === "es" ? "en" : "by"} ${mode}.` : "";
  const call =
    lang === "es"
      ? ` Responde LLAMAR, o comparte tu ubicación 📍 para un mapa y direcciones.`
      : ` Reply CALL, or share your location 📍 for a map + directions.`;

  return `${stamp} ${r.name} ${space}.${intake}${travel} ${r.address}, ${r.city}.${call}`;
}

export function fullFallback(nextName: string | null, lang: Lang): string {
  if (!nextName) {
    return lang === "es"
      ? "Resultó que ese refugio ya no tiene espacio — por eso siempre confirmo. Sigo buscando otra opción para ti."
      : "That shelter turned out to be full — exactly why I check first. Let me keep looking for another option.";
  }
  return lang === "es"
    ? `Ese refugio ya estaba lleno (por eso confirmo antes de mandarte). La siguiente mejor opción es ${nextName}. ¿La verifico también? Responde SÍ.`
    : `That one was already full — this is why I verify before sending anyone. Next best is ${nextName}. Want me to verify it too? Reply YES.`;
}

export function noMatch(lang: Lang): string {
  return lang === "es"
    ? "No encontré una cama que cumpla con todo ahora mismo. Puedo conectarte con la línea del condado al 2-1-1 o buscar comida/duchas cercanas. ¿Qué prefieres?"
    : "I couldn't find a bed matching everything right now. I can connect you to the county line at 2-1-1, or find nearby food/showers. Which would help most?";
}

export function crisisReply(lang: Lang): string {
  return lang === "es"
    ? "Lo que sientes importa y no estás solo/a. Por favor llama o envía un mensaje al 988 ahora mismo — hay alguien disponible 24/7. Si estás en peligro inmediato, llama al 911. Me quedo aquí contigo."
    : "What you're feeling matters and you're not alone. Please call or text 988 right now — someone is there 24/7. If you're in immediate danger, call 911. I'm staying right here with you.";
}

export function callAhead(resourceName: string, phone: string, c: Constraints, lang: Lang): string {
  const who = childPhrase(c, lang);
  return lang === "es"
    ? `Listo. Le avisé a ${resourceName} que vas en camino ${who}. Su línea de admisión: ${phone}. Pregunta por admisión al llegar.`
    : `Done — I've flagged ${resourceName} that you're on the way ${who}. Their intake line: ${phone}. Ask for intake when you arrive.`;
}

export function directionsReply(resourceName: string, dir: Directions, lang: Lang): string {
  const head =
    lang === "es"
      ? `🗺️ Direcciones a ${resourceName} (~${dir.durationMin} min, ${dir.distanceMi} mi):`
      : `🗺️ Directions to ${resourceName} (~${dir.durationMin} min, ${dir.distanceMi} mi):`;
  const steps = dir.steps
    .slice(0, 7)
    .map((s, i) => `${i + 1}. ${s.instruction}${s.distanceFt > 0 ? ` — ${fmtDist(s.distanceFt)}` : ""}`)
    .join("\n");
  return `${head}\n${steps}`;
}

export function locationAck(lang: Lang): string {
  return lang === "es"
    ? "Recibí tu ubicación 📍. Dime qué necesitas (ej. 'cama esta noche, 2 niños') y busco un refugio cercano."
    : "Got your location 📍. Tell me what you need (e.g. 'bed tonight, 2 kids') and I'll find a shelter near you.";
}

// Feet under a tenth of a mile, miles above (1 decimal, or whole miles past 10).
function fmtDist(ft: number): string {
  const mi = ft / 5280;
  if (mi >= 0.1) return `${mi.toFixed(mi >= 10 ? 0 : 1)} mi`;
  return `${Math.round(ft / 10) * 10} ft`;
}

// The cutoff time is carried inside the human-readable reasons; pull it back out for copy.
function cutoffStrFromReasons(match: MatchResult): string | null {
  // reasons hold "Intake closes 9 PM" — but we want the raw HH:MM; recompute from resource hours.
  const today = match.resource.hours[new Date().getDay()];
  if (!today) return null;
  return today.intakeCutoff ?? today.close;
}
