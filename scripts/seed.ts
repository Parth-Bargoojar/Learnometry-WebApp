/*
  `npm run db:seed` (BE-D62) — idempotent.

    reference data   exams, Class 11 Mechanics graph on 3 tracks, plans, coupon, flags   (always)
    sample questions the current sample bank, published                                  (not production)
    seed accounts    rohan, sunita, new, out, adult, admin @seed.learnometry.test         (local/dev/staging)

  Accounts are created only against a local Supabase (127.0.0.1 / localhost) unless you pass
  --accounts, and never with --reference-only. Production runs reference data only.
*/
import { createClient } from "@supabase/supabase-js";
import { createDb } from "../src/lib/db/connection";
import { seedAccounts, SEED_ACCOUNTS, SEED_PASSWORD } from "../src/lib/db/seed/accounts";
import { seedSampleQuestions } from "../src/lib/db/seed/questions";
import { seedReference } from "../src/lib/db/seed/reference";

async function main() {
  const args = new Set(process.argv.slice(2));
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DIRECT_DATABASE_URL (npm run db:start prints the local one)");
  const production = process.env.NODE_ENV === "production" || args.has("--production");
  const referenceOnly = args.has("--reference-only") || production;

  const { db, sql } = createDb(url, { max: 2 });
  try {
    const summary = await seedReference(db);
    console.log("reference:", summary);
    if (!referenceOnly) {
      const n = await seedSampleQuestions(db);
      console.log(`sample questions: ${n}`);
    }

    const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const local = /^(https?:\/\/)(127\.0\.0\.1|localhost)/.test(api);
    if (!referenceOnly && (local || args.has("--accounts"))) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create seed accounts");
      const admin = createClient(api, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const emails = await seedAccounts(db, admin);
      console.log(`accounts: ${emails.length} (password ${SEED_PASSWORD})`);
      console.log(SEED_ACCOUNTS.map((a) => `  ${a.email}  ${a.role}`).join("\n"));
    } else if (!referenceOnly) {
      console.log("accounts: skipped (not a local database; pass --accounts to force)");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
