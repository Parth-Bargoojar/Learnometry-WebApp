import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/*
  Integration tests run against the LOCAL Supabase stack (`npm run db:start`). They create and
  delete users and rows, so they must never touch a hosted project. Connection settings come
  from, in order: the process environment (CI exports them), `.env.local`, and finally
  `supabase status -o env`. If the result is not local (`.env.local` may point at the deployed
  project), the connection settings are discarded and the local ones are used instead.
*/
function loadDotEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env.local"));

const isLocal = (v?: string) => !v || /(127\.0\.0\.1|localhost)/.test(v);
const CONNECTION_VARS = ["DIRECT_DATABASE_URL", "DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const hosted = !isLocal(process.env.DIRECT_DATABASE_URL) || !isLocal(process.env.DATABASE_URL) || !isLocal(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (hosted) for (const k of CONNECTION_VARS) delete process.env[k];

if (!process.env.DIRECT_DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?\s*$/.exec(line.trim());
    if (m) status[m[1]] = m[2];
  }
  process.env.DIRECT_DATABASE_URL ??= status.DB_URL;
  process.env.DATABASE_URL ??= status.DB_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= status.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= status.SERVICE_ROLE_KEY;
}

if (![process.env.DIRECT_DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL].every((v) => isLocal(v))) {
  throw new Error("Refusing to run integration tests against a non-local database.");
}
