import { describe, expect, it } from "vitest";
import { packItem, passItem, prorate, refundEligibility, refundWindow, upgradeDue, applyCoupon, totalDue, passStatus } from "./rules";

const campaigns = { EARLYACCESS: { percentOff: 20, bonusCredits: 100, firstPassOnly: true, endsOn: "2026-11-15" } };
const ctx = { redeemed: [], hadPaidPass: false, today: "2026-09-27", campaigns };

describe("upgradeDue (ALG §12)", () => {
  it("subtracts the unused value, rounded down to the rupee", () => {
    expect(upgradeDue({ newPriceInr: 349, currentPriceInr: 299, remainingDays: 15 })).toBe(349 - 149);
    expect(upgradeDue({ newPriceInr: 299, currentPriceInr: 199, remainingDays: 10 })).toBe(299 - 66);
  });

  it("never charges less than ₹1 and clamps remaining days to 0–30", () => {
    expect(upgradeDue({ newPriceInr: 199, currentPriceInr: 349, remainingDays: 30 })).toBe(1);
    expect(upgradeDue({ newPriceInr: 299, currentPriceInr: 199, remainingDays: 99 })).toBe(100);
    expect(upgradeDue({ newPriceInr: 299, currentPriceInr: 199, remainingDays: -4 })).toBe(299);
  });
});

describe("refundEligibility (ALG §12)", () => {
  const first = new Date("2026-09-20T10:00:00Z");
  it("is eligible within 7 days and under 20% use", () => {
    expect(refundEligibility({ now: new Date("2026-09-27T09:59:00Z"), firstPaymentAt: first, issued: 1000, used: 199 })).toMatchObject({ eligible: true, usedShare: 0.199 });
  });
  it("fails on time, on usage, or on the 20% boundary", () => {
    expect(refundEligibility({ now: new Date("2026-09-27T10:01:00Z"), firstPaymentAt: first, issued: 1000, used: 0 }).withinWindow).toBe(false);
    expect(refundEligibility({ now: first, firstPaymentAt: first, issued: 1000, used: 200 })).toMatchObject({ eligible: false, underUsage: false });
  });
  it("treats nothing issued as nothing used", () => {
    expect(refundEligibility({ now: first, firstPaymentAt: first, issued: 0, used: 0 })).toMatchObject({ eligible: true, usedShare: 0 });
  });
});

describe("date-string billing helpers", () => {
  it("prorates, previews and reports pass status", () => {
    expect(prorate("starter", "pro", "2026-10-10", "2026-09-27")).toEqual({ credit: 86, due: 263, remaining: 13 });
    expect(passStatus("2026-09-29", { today: "2026-09-27" })).toBe("ends_soon");
    expect(passStatus("2026-09-29", { today: "2026-09-27", renewalFailed: true })).toBe("renewal_failed");
    expect(passStatus("2026-09-26", { today: "2026-09-27", renewalFailed: true })).toBe("ended");
    expect(passStatus("2026-10-27", { today: "2026-09-27" })).toBe("active");
    expect(refundWindow("2026-09-20", 0.1, "2026-09-27")).toMatchObject({ eligible: true, until: "2026-09-27" });
  });

  it("builds checkout items and applies coupons", () => {
    const upgrade = passItem("pro", "starter", "2026-10-10", "2026-09-27");
    expect(upgrade.prorationInr).toBe(86);
    expect(passItem("plus", "free", "2026-10-10", "2026-09-27").prorationInr).toBeUndefined();
    expect(packItem("pack_250").priceInr).toBe(99);
    const r = applyCoupon("earlyaccess", passItem("plus", "free", "2026-10-10", "2026-09-27"), ctx);
    expect(r).toMatchObject({ ok: true, discountInr: 59, bonusCredits: 100 });
    expect(totalDue(passItem("plus", "free", "2026-10-10", "2026-09-27"), r)).toBe(240);
    expect(applyCoupon("x", upgrade, ctx).ok).toBe(false);
    expect(applyCoupon("EARLYACCESS", upgrade, { ...ctx, today: "2026-12-01" }).message).toContain("ended");
  });
});
