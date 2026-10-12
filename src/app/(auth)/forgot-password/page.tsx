import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-recovery";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const { error } = await props.searchParams;
  return <ForgotPasswordForm expired={error === "expired"} />;
}
