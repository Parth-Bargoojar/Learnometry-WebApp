import { NextResponse, type NextRequest } from "next/server";
import { landingPathFor, resolveDeletionAtSignIn } from "@/domains/identity/service";
import { safeNextPath } from "@/domains/identity/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENTS, sendEvent } from "@/inngest/client";

/*
  OAuth return (Google) — PKCE code exchange (BE-D26, BE-D73). Email links use /auth/confirm
  instead, because they must also work when opened on a different device from sign-up.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const fail = () => NextResponse.redirect(new URL("/login?error=callback", origin));
  if (!code) return fail();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail();

  const outcome = await resolveDeletionAtSignIn(data.user.id);
  if (outcome === "blocked") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?reason=deletion_pending", origin));
  }
  if (outcome === "cancelled") await sendEvent(EVENTS.accountDeletionCancelled, { userId: data.user.id });

  const landing = await landingPathFor(data.user.id);
  const next = landing === "/dashboard" ? safeNextPath(searchParams.get("next"), landing) : landing;
  return NextResponse.redirect(new URL(next, origin));
}
