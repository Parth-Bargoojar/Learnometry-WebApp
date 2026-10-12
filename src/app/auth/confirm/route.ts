import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { landingPathFor } from "@/domains/identity/service";
import { safeNextPath } from "@/domains/identity/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
  Email links: confirm sign-up, reset password, confirm a new address. The link carries a
  one-time token hash, so it works on any device (no PKCE verifier cookie needed). It logs the
  person in, then sends them where that kind of link belongs (BE-D73).
*/
const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const back = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!tokenHash || !type || !TYPES.includes(type)) return back("/login?error=link");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return back(type === "recovery" ? "/forgot-password?error=expired" : "/login?error=link");

  if (type === "recovery") return back("/reset-password");
  if (type === "email_change") return back(safeNextPath(searchParams.get("next"), "/settings/profile"));
  return back(await landingPathFor(data.user.id));
}
