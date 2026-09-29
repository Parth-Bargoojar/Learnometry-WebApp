import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth-recovery";

export const metadata: Metadata = { title: "Check your inbox" };

export default function VerifyEmailPage() {
  return <VerifyEmail />;
}
