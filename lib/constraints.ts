import type { Constraints } from "./types";

/**
 * Deterministic constraint extraction from a free-text message, EN + ES.
 *
 * Why rules instead of an LLM here: this is the one step that must NEVER fail or hallucinate
 * during a live demo, and the phrases people use in crisis ("somewhere tonight", "2 kids",
 * "family of 3", "no car", "esta noche", "mis 2 hijos", "sin carro") are narrow and
 * predictable. An LLM layer can enrich this later; the deterministic extractor is the
 * dependable floor, and it is trivially unit-testable.
 */

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
};
const NUM = "\\d+|one|two|three|four|five|six|seven|eight|uno|dos|tres|cuatro|cinco|seis|siete|ocho";

function wordToNum(token: string): number | null {
  const t = token.toLowerCase();
  if (NUM_WORDS[t] != null) return NUM_WORDS[t];
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function extractConstraints(message: string): Constraints {
  const text = message.toLowerCase();
  const out: Constraints = {};

  // ZIP — 5 digits standing alone
  const zip = message.match(/\b(\d{5})\b/);
  if (zip) out.zip = zip[1];

  // Urgency (EN + ES)
  if (/\b(tonight|tonite|right now|asap|nowhere to (sleep|stay)|sleep tonight|no place to sleep|esta noche|hoy|ahora mismo|no tengo donde dormir)\b/.test(text)) {
    out.urgency = "tonight";
  } else if (/\b(tomorrow|this week|few days|soon|ma[ñn]ana|esta semana|pronto)\b/.test(text)) {
    out.urgency = "soon";
  }

  // Explicit child count: "2 kids", "mis 2 hijos"
  const kidMatch = text.match(
    new RegExp(`(${NUM})\\s*(kids?|childrens?|child|sons?|daughters?|babies|baby|hijos?|hijas?|ni[ñn]os?|ni[ñn]as?)`),
  );
  if (kidMatch) {
    const n = wordToNum(kidMatch[1]);
    if (n != null) {
      out.childrenCount = n;
      out.family = true;
    }
  }

  // "family of 3", "party of 4", "familia de 3"
  const familyOf = text.match(new RegExp(`(?:family|party|household|group|familia|grupo)\\s+(?:of|de)\\s+(${NUM})`));
  if (familyOf) {
    const n = wordToNum(familyOf[1]);
    if (n != null) {
      out.family = true;
      out.bedsNeeded = n;
    }
  }

  // "3 people", "3 of us", "somos 4"
  const party = text.match(new RegExp(`(?:(${NUM})\\s*(?:people|persons|of us|personas)|somos\\s*(${NUM}))`));
  if (party) {
    const n = wordToNum(party[1] ?? party[2]);
    if (n != null) {
      out.bedsNeeded = out.bedsNeeded ?? n;
      if (n > 1) out.family = out.family ?? true;
    }
  }

  // General family signals without a number
  if (out.family == null && /\b(my kids|my children|my family|with my (son|daughter|baby|kids|children)|we are a family|mi familia|mis hijos|mis ni[ñn]os|somos una familia)\b/.test(text)) {
    out.family = true;
  }

  // Gender self-identification (EN + ES)
  if (/\b(i'?m a woman|i am a woman|female|woman|women|she\/her|mother|mom|mujer|madre|mam[áa])\b/.test(text)) {
    out.gender = "woman";
  } else if (/\b(i'?m a man|i am a man|male|man|men|he\/him|father|dad|hombre|padre|pap[áa])\b/.test(text)) {
    out.gender = "man";
  } else if (/\b(non[- ]?binary|enby|they\/them|no binario)\b/.test(text)) {
    out.gender = "nonbinary";
  }

  // Accessibility (EN + ES)
  if (/\b(wheelchair|ada|accessible|can'?t do stairs|disab|mobility|silla de ruedas|discapacidad)\b/.test(text)) {
    out.ada = true;
  }

  // Pets / service animal (EN + ES)
  if (/\b(dog|cat|pet|puppy|service animal|emotional support|perro|gato|mascota)\b/.test(text)) {
    out.pets = true;
  }

  // Transportation (EN + ES)
  if (/\b(no car|don'?t have a car|without a car|no vehicle|by bus|on foot|walking|can'?t drive|no ride|no tengo (carro|coche|auto)|sin (carro|coche|auto)|en autob[úu]s|a pie|caminando)\b/.test(text)) {
    out.noCar = true;
  }

  return out;
}

/**
 * Merge newly-extracted constraints onto what we already know about a person. New, specific
 * information wins; we never unset something they told us earlier (so "95035" later in the
 * conversation doesn't wipe out the "2 kids" from their first message).
 */
export function mergeConstraints(prev: Constraints, next: Constraints): Constraints {
  return {
    zip: next.zip ?? prev.zip,
    urgency: next.urgency ?? prev.urgency,
    family: next.family ?? prev.family,
    childrenCount: next.childrenCount ?? prev.childrenCount,
    bedsNeeded: next.bedsNeeded ?? prev.bedsNeeded,
    gender: next.gender ?? prev.gender,
    ada: next.ada ?? prev.ada,
    pets: next.pets ?? prev.pets,
    noCar: next.noCar ?? prev.noCar,
  };
}

/** Crisis signals that should halt resource-matching and trigger a warm 988 handoff. */
export function isCrisis(message: string): boolean {
  return /\b(kill myself|suicid|end my life|don'?t want to live|dont want to live|hurt myself|self harm|want to die|quiero morir|matarme|no quiero vivir)\b/i.test(
    message,
  );
}
