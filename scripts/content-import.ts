/*
  `npm run content:import -- [--dry-run] [--hosted]` (BE-3.2): content/**.yaml → Draft questions.

  Validates first and refuses to import anything while there are errors. Runs against
  DIRECT_DATABASE_URL; a non-local database needs --hosted so a stray .env.local cannot write
  to the live project by accident.
*/
import { createDb } from "../src/lib/db/connection";
import { loadContent } from "../src/domains/content/load";
import { importContent } from "../src/domains/content/import";

async function main() {
  const args = new Set(process.argv.slice(2));
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DIRECT_DATABASE_URL (npm run db:start prints the local one)");
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  if (!local && !args.has("--hosted")) throw new Error("This is not a local database. Re-run with --hosted if you mean to import there.");

  const { files, findings } = loadContent();
  const errors = findings.filter((f) => f.severity === "error");
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR ${e.file} ${e.id} [${e.validator}] ${e.message}`);
    throw new Error(`${errors.length} validation errors; nothing was imported`);
  }

  const { db, sql } = createDb(url, { max: 2 });
  try {
    const summary = await importContent(db, files, { dryRun: args.has("--dry-run") });
    console.log(`${args.has("--dry-run") ? "dry run: " : ""}created ${summary.created}, changed ${summary.changed}, unchanged ${summary.unchanged}`);
    if (summary.missingConcepts.length) console.warn("concepts missing from the database:", summary.missingConcepts);
    if (summary.orphaned.length) console.warn(`${summary.orphaned.length} questions in the database are no longer in the files (not deleted):`, summary.orphaned.slice(0, 20));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
