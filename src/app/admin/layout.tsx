import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Learnometry admin" } };

/* Shell F — Admin (Web App Structure §5.7, §8.19). role = admin + 2FA (K1). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
