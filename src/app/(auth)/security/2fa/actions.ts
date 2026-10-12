"use server";

import { enrollTotp, verifyTotp } from "@/domains/identity/auth";
import { totpCodeSchema } from "@/domains/identity/schemas";
import { getViewer } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { parseInput } from "@/lib/errors/parse";
import { run } from "@/lib/errors/result";
import { z } from "zod";

/* Admin second factor (K1, API.md `enrollAdminTotp` / `verifyAdminTotp`). Role-checked on every call. */

async function requireAdminRole() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.status !== "active") throw new AppError("forbidden");
  return viewer;
}

export async function enrollAdminTotpAction() {
  return run(async () => {
    await requireAdminRole();
    return enrollTotp();
  });
}

export async function verifyAdminTotpAction(input: unknown) {
  return run(async () => {
    await requireAdminRole();
    const { factorId, code } = parseInput(totpCodeSchema.extend({ factorId: z.string().uuid() }), input);
    await verifyTotp(factorId, code);
    return { verified: true as const };
  });
}
