import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

/*
  One connection pool per server instance (BE-D17). `DATABASE_URL` is the Supabase transaction
  pooler (port 6543 in hosted environments), so prepared statements are off and each instance
  holds a single connection. Tests and scripts build their own with `createDb`.
*/
export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, { prepare: false, max: opts.max ?? 1, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];
/** The handle inside `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __lmDb?: ReturnType<typeof createDb> };

export function getDb(): Db {
  globalForDb.__lmDb ??= createDb(requireEnv("DATABASE_URL"));
  return globalForDb.__lmDb.db;
}
