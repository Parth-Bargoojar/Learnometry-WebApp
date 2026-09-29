import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/*
  Integration tests run against the local Supabase stack (`npm run db:start`). Connection
  settings come from, in order: the process environment (CI exports them), `.env.local`,
  and finally `supabase status -o env`, so a fresh checkout works with no setup.
*/
function loadDotEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env.local"));

if (!process.env.DIRECT_DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) status[m[1]] = m[2];
  }
  process.env.DIRECT_DATABASE_URL ??= status.DB_URL;
  process.env.DATABASE_URL ??= status.DB_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= status.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= status.SERVICE_ROLE_KEY;
}
