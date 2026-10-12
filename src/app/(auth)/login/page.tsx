import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Log in" };

/** `?next=` is where to go after logging in; `?error=` / `?reason=` explain why the person is back here. */
export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error, reason } = await props.searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <LoginForm next={one(next)} notice={one(error) ?? one(reason)} />;
}
