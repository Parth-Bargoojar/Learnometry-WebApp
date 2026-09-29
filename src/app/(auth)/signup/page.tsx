import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

/** `?role=guardian` comes from the consent page's "Create a guardian account" link. */
export default async function SignupPage(props: PageProps<"/signup">) {
  const { role } = await props.searchParams;
  return <SignupForm defaultRole={role === "guardian" ? "guardian" : "student"} />;
}
