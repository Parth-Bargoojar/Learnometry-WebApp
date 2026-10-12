import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Learnometry admin" } };

/* Shell F — Admin (Web App Structure §5.7, §8.19). role = admin + a fresh second factor (K1, BE-D26); anyone else gets a 404 from the root boundary. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
