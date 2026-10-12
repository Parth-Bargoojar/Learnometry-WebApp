import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

/*
  Coarse gate (BE-D3): keep the Supabase session fresh and send signed-out visitors to /login.
  This is NOT the security boundary — every page, action and route handler re-checks the
  session, role and consent in the data access layer.

  Public: the auth screens, the guardian consent link, the offline page, the auth callbacks and
  the Inngest endpoint. `/admin` is public here on purpose: it answers 404 to anyone who is not
  an admin with a fresh second factor, signed in or not (K1), and must not redirect to a login
  that would reveal the console exists.
*/
const PUBLIC_PREFIXES = ["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/consent", "/offline", "/auth", "/api/inngest", "/admin"];
const AUTH_SCREENS = ["/login", "/signup", "/forgot-password"];

const isPublic = (path: string) => PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { response, signedIn } = await refreshSession(request);
  const path = request.nextUrl.pathname;

  if (!signedIn && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_SCREENS.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static files, Next internals, the service worker and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|theme.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?|txt|xml)$).*)"],
};
