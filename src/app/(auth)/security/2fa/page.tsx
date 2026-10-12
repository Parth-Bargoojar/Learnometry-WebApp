import type { Metadata } from "next";
import { AdminTwoFactor } from "@/components/admin-2fa";
import { totpState } from "@/domains/identity/auth";
import { safeNextPath } from "@/domains/identity/rules";
import { requireAdminForSecondFactor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Two-step check" };

/** Only an active admin sees this screen; everyone else gets a 404 (K1). */
export default async function TwoFactorPage(props: PageProps<"/security/2fa">) {
  await requireAdminForSecondFactor();
  const { next } = await props.searchParams;
  const { factorId } = await totpState();
  return <AdminTwoFactor factorId={factorId} next={safeNextPath(typeof next === "string" ? next : undefined, "/admin")} />;
}
