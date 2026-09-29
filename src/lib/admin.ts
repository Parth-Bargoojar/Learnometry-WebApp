/**
 * Admin console rules — Web App Structure §8.19 and build decisions K1–K16 (§8.19a).
 * The rules live in `src/domains/admin/rules.ts` (BE-0.4); `refundCheck` keeps the sample
 * "today" default for the console previews until BE-13.
 */
import { refundCheck as refundCheckAt } from "@/domains/admin/rules";
import { TODAY } from "./data";

export * from "@/domains/admin/rules";

export const refundCheck = (firstPayment: string, usedShare: number, today = TODAY) => refundCheckAt(firstPayment, usedShare, today);
