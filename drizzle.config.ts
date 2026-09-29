import { defineConfig } from "drizzle-kit";

/*
  Drizzle owns the table/RLS definitions; SQL functions, triggers and grants live in custom
  migrations (`drizzle-kit generate --custom`). Files are written straight into
  supabase/migrations with the Supabase timestamp prefix and applied by the Supabase CLI
  (BE-D15). Never edit a migration that has run outside your own local database.
*/
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./supabase/migrations",
  schemaFilter: ["public"],
  migrations: { prefix: "supabase" },
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
