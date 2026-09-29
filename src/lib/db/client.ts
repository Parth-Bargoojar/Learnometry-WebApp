import "server-only";
import { sql } from "drizzle-orm";
import { AppError } from "@/lib/errors/app-error";
import { getDb, type Db, type Tx } from "./connection";

/*
  Row Level Security applies to everything run through `asUser` (BE-D16): the transaction
  switches to the `authenticated` role and sets the caller's JWT claims, exactly as Supabase's
  API gateway would, so `auth.uid()` and every policy see the real user. A missing ownership
  check in code is therefore still stopped by the database.

  `db.system` (RLS bypass) lives in ./system.ts and is import-restricted by ESLint.
*/
export interface UserClaims {
  /** Supabase auth user id. */
  sub: string;
  [claim: string]: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same as `asUser` but on an explicit handle (integration tests use their own connection). */
export async function runAsUser<T>(db: Db, claims: UserClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(claims.sub)) throw new AppError("unauthenticated");
  const payload = JSON.stringify({ ...claims, role: "authenticated" });
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${payload}, true), set_config('request.jwt.claim.sub', ${claims.sub}, true), set_config('request.jwt.claim.role', 'authenticated', true)`,
    );
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/** Run `fn` as an anonymous caller: RLS applies with no user. Used by tests and public reads of reference data. */
export async function runAsAnon<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role anon`);
    return fn(tx);
  });
}

/** Run `fn` as the signed-in user, inside one transaction, with RLS enforced. */
export const asUser = <T>(claims: UserClaims, fn: (tx: Tx) => Promise<T>): Promise<T> => runAsUser(getDb(), claims, fn);

export type { Db, Tx };
