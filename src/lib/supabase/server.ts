import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

/*
  Supabase Auth from the server only (BE-D73): the browser never loads the Supabase SDK, so
  the JS budget is untouched and the anon key never has to be trusted with anything. Sessions
  live in httpOnly cookies managed by @supabase/ssr; `src/proxy.ts` refreshes them.
*/
export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the session.
        }
      },
    },
  });
}
