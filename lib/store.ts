import { Redis } from "@upstash/redis";
import type {
  Conversation,
  ImpactCounters,
  Resource,
  Verification,
} from "./types";
import { SEED_RESOURCES } from "./resources";

/**
 * Shared application state for Polaris.
 *
 * Backed by an in-memory object by default — zero config, ideal for `next dev` (single
 * process) behind a tunnel during a demo. When Upstash/Vercel KV env vars are present it
 * transparently persists to Redis, so the same code survives multi-instance serverless on
 * Vercel. The whole state is small (a handful of resources + a live demo's worth of
 * conversations), so we read-modify-write the blob as one document — simple and correct for
 * the traffic a demo sees.
 */
interface AppState {
  resources: Resource[];
  conversations: Record<string, Conversation>;
  verifications: Verification[];
  impact: ImpactCounters;
  seeded: boolean;
}

const STATE_KEY = "polaris:state:v1";

// Accept either Upstash-native or Vercel-KV-style env var names.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

// Pin the in-memory state on globalThis so it survives Next.js dev HMR module reloads
// (without this, different route handlers can end up with divergent module instances) and is
// shared across a warm serverless instance.
const globalForState = globalThis as unknown as { __polarisState?: AppState };

function freshSeed(): AppState {
  const resources = SEED_RESOURCES.map((r) => ({ ...r }));
  // Initial freshness overlay so the dashboard isn't a sea of "unverified" on first load.
  // The demo's family-shelter target (fsh-sj) is intentionally left stale to trigger a call.
  const now = Date.now();
  const overlay: Record<string, number> = {
    "homefirst-brc": now - 4 * 60_000, // self-reported 4 min ago
    "homefirst-sunnyvale": now - 26 * 60_000,
    "cityteam-sj": now - 70 * 60_000,
  };
  for (const r of resources) {
    if (overlay[r.id] != null) {
      r.lastVerifiedAt = overlay[r.id];
      r.verifyMethod = "self";
    }
  }
  return {
    resources,
    conversations: {},
    verifications: [],
    impact: { ghostBedsAvoided: 0, verifiedRoutes: 0, providerUpdates: 0 },
    seeded: true,
  };
}

async function read(): Promise<AppState> {
  if (redis) {
    const stored = (await redis.get<AppState>(STATE_KEY)) ?? null;
    if (stored && stored.seeded) return stored;
    const seeded = freshSeed();
    await redis.set(STATE_KEY, seeded);
    return seeded;
  }
  if (!globalForState.__polarisState) globalForState.__polarisState = freshSeed();
  return globalForState.__polarisState;
}

async function write(state: AppState): Promise<void> {
  if (redis) {
    await redis.set(STATE_KEY, state);
  } else {
    globalForState.__polarisState = state;
  }
}

// ---------- public API ----------

export async function getState(): Promise<AppState> {
  return read();
}

export async function getResources(): Promise<Resource[]> {
  return (await read()).resources;
}

export async function getResource(id: string): Promise<Resource | undefined> {
  return (await read()).resources.find((r) => r.id === id);
}

export async function updateResource(
  id: string,
  patch: Partial<Resource>,
): Promise<Resource | undefined> {
  const state = await read();
  const idx = state.resources.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  state.resources[idx] = { ...state.resources[idx], ...patch };
  await write(state);
  return state.resources[idx];
}

export async function getConversation(
  id: string,
): Promise<Conversation | undefined> {
  return (await read()).conversations[id];
}

export async function upsertConversation(conv: Conversation): Promise<void> {
  const state = await read();
  state.conversations[conv.id] = conv;
  await write(state);
}

export async function listConversations(limit = 20): Promise<Conversation[]> {
  const state = await read();
  return Object.values(state.conversations)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export async function addVerification(v: Verification): Promise<void> {
  const state = await read();
  state.verifications.unshift(v);
  state.verifications = state.verifications.slice(0, 50);
  await write(state);
}

export async function updateVerification(
  id: string,
  patch: Partial<Verification>,
): Promise<Verification | undefined> {
  const state = await read();
  const idx = state.verifications.findIndex((v) => v.id === id);
  if (idx === -1) return undefined;
  state.verifications[idx] = { ...state.verifications[idx], ...patch };
  await write(state);
  return state.verifications[idx];
}

export async function getVerification(
  id: string,
): Promise<Verification | undefined> {
  return (await read()).verifications.find((v) => v.id === id);
}

export async function listVerifications(limit = 20): Promise<Verification[]> {
  return (await read()).verifications.slice(0, limit);
}

export async function bumpImpact(patch: Partial<ImpactCounters>): Promise<void> {
  const state = await read();
  state.impact = {
    ghostBedsAvoided: state.impact.ghostBedsAvoided + (patch.ghostBedsAvoided ?? 0),
    verifiedRoutes: state.impact.verifiedRoutes + (patch.verifiedRoutes ?? 0),
    providerUpdates: state.impact.providerUpdates + (patch.providerUpdates ?? 0),
  };
  await write(state);
}

export async function getImpact(): Promise<ImpactCounters> {
  return (await read()).impact;
}

/** Reset to a clean seeded state — handy for re-running the demo. */
export async function resetState(): Promise<void> {
  await write(freshSeed());
}
