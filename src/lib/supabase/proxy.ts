import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
  Session refresh for `src/proxy.ts` (BE-D3). Reads the auth cookies, lets Supabase refresh a
  token that is about to expire, and writes the new cookies on both the request (so the page
  render sees them) and the response (so the browser keeps them). It never decides access: the
  proxy is a coarse redirect, every page and action re-checks in the data access layer.
  Reads the two public variables directly so the proxy stays free of the server-only env module.
*/
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, signedIn: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        // Auth responses must not be cached by a CDN.
        for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  // getClaims validates the JWT (locally with asymmetric keys, via the auth server otherwise).
  const { data } = await supabase.auth.getClaims();
  return { response, signedIn: Boolean(data?.claims?.sub) };
}
