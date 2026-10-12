import "server-only";
import { eq } from "drizzle-orm";
import { system } from "@/lib/db/system";
import * as s from "@/lib/db/schema";
import { now } from "@/lib/time";

/*
  Feature flags (BE-D49): read from `feature_flags` with a 60-second in-memory TTL per server
  instance, so an operator's change reaches every instance within a minute (K11).
*/
export interface FlagValue {
  enabled: boolean;
  config: Record<string, unknown> | null;
}

const TTL_MS = 60_000;
const cache = new Map<string, { value: FlagValue; at: number }>();

export async function getFlag(key: string): Promise<FlagValue> {
  const hit = cache.get(key);
  if (hit && now().getTime() - hit.at < TTL_MS) return hit.value;
  const [row] = await system((tx) => tx.select({ enabled: s.featureFlags.enabled, config: s.featureFlags.config }).from(s.featureFlags).where(eq(s.featureFlags.key, key)));
  // A missing flag is off: risky capability ships dark.
  const value: FlagValue = row ? { enabled: row.enabled, config: row.config } : { enabled: false, config: null };
  cache.set(key, { value, at: now().getTime() });
  return value;
}

export const isFlagOn = async (key: string) => (await getFlag(key)).enabled;

/** Test hook. */
export function clearFlagCache() {
  cache.clear();
}
