import { resetState } from "@/lib/store";

// Re-seed to a clean state between demo runs.
export const dynamic = "force-dynamic";

export async function POST() {
  await resetState();
  return Response.json({ ok: true });
}
