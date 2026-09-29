import "./setup";
import { createClient } from "@supabase/supabase-js";
import { createDb, type Db, type Tx } from "@/lib/db/connection";
import { runAsAnon, runAsUser } from "@/lib/db/client";

/*
  Integration harness (BE-1.6). `db` is the owner connection (RLS bypass, like db.system) for
  arranging data; `asUser` / `asAnon` run the assertions through the same role switch the app
  uses, so a passing test proves the policies, not just the code.
*/
export const { sql: pg, db } = createDb(process.env.DIRECT_DATABASE_URL!, { max: 4 });

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const asUser = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => runAsUser(db as Db, { sub: userId }, fn);
export const asAnon = <T>(fn: (tx: Tx) => Promise<T>) => runAsAnon(db as Db, fn);

let counter = 0;
const created: string[] = [];

export interface TestUser {
  id: string;
  email: string;
  learnerId: string | null;
}

/** A real auth user; the auth trigger creates the profile (and learner + credit account). */
export async function createUser(role: "learner" | "guardian" | "admin" = "learner", name = "Test User"): Promise<TestUser> {
  const email = `t${Date.now()}-${counter++}-${Math.random().toString(36).slice(2, 8)}@test.learnometry.local`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "Passw0rd-test-only",
    email_confirm: true,
    user_metadata: { role, name },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);
  const rows = await pg<{ id: string }[]>`select id from public.learners where user_id = ${data.user.id}`;
  return { id: data.user.id, email, learnerId: rows[0]?.id ?? null };
}

/** Delete every user created through `createUser` (cascades through the profile tables). */
export async function cleanupUsers() {
  for (const id of created.splice(0)) {
    // Erasure sets this to allow the ledger rows to go with the account (BE-D58).
    await pg.begin(async (tx) => {
      await tx`select set_config('app.allow_ledger_delete', 'on', true)`;
      await tx`delete from auth.users where id = ${id}`;
    });
  }
}

/** Resolve with the error code of a rejected query (`42501` = permission denied / RLS), or null when it succeeded. */
export async function errorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    let cur: unknown = e;
    while (cur && typeof cur === "object") {
      const code = (cur as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
      cur = (cur as { cause?: unknown }).cause;
    }
    return "unknown";
  }
}

export const PERMISSION_DENIED = "42501";
