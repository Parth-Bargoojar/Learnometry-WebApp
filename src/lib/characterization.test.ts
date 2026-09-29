/*
  BE-0.4 characterization: snapshots of today's pure rules, taken BEFORE they moved into
  the domains rules files. The move must not change a single output (the screens stay
  pixel-identical). If a snapshot changes, the rule changed — that needs a BE-D row.
*/
import { describe, expect, it } from "vitest";
import * as admin from "./admin";
import * as billing from "./billing";
import * as config from "./config";
import { DIAGNOSTIC_ID, RETEST_ID, TODAY, getAttemptConfig, sampleDiagnosticResponses, sampleRetestResponses } from "./data";
import * as diagnosis from "./diagnosis";
import * as guardian from "./guardian";
import * as fmt from "./format";

const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => i + from);

describe("config rules", () => {
  it("constants", () => {
    expect({ PLANS: config.PLANS, COST: config.COST, PACKS: config.CREDIT_PACKS, presets: config.DAILY_MINUTE_PRESETS }).toMatchSnapshot();
  });
  it("confidence / severity / priority / retest outcome", () => {
    const rows = range(8).map((n) => [n, config.confidenceFor(n)]);
    const sev = (["insufficient", "low", "medium", "high"] as const).flatMap((c) =>
      [0, 34, 35, 49, 50, 64, 65, 79, 80, 100].map((m) => [c, m, config.severityFor(m, c), config.showsMasteryNumber(c)]),
    );
    const pri = [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1].map((s) => [s, config.priorityFor(s)]);
    const ret = [[-20, 3], [-10, 3], [-9, 3], [0, 3], [9, 3], [10, 3], [40, 3], [40, 2], [-40, 0]].map(([d, n]) => [d, n, config.retestOutcome(d, n)]);
    expect({ rows, sev, pri, ret }).toMatchSnapshot();
  });
  it("credit state and 'enough for'", () => {
    const states = [0, 1, 19, 20, 40, 41, 100, 350].flatMap((b) => [30, 200, 500].map((p) => [b, p, config.creditStateFor(b, p)]));
    const enough = [0, 4, 5, 19, 20, 60, 69, 70, 71, 90, 91, 500].map((b) => [b, config.enoughFor(b)]);
    const cost = [5, 10, 15].map((q) => config.practiceCost(q));
    expect({ states, enough, cost }).toMatchSnapshot();
  });
});

describe("billing rules", () => {
  it("passStatus and proration", () => {
    const status = ["2026-09-25", "2026-09-27", "2026-09-30", "2026-10-01", "2026-10-20"].flatMap((e) => [false, true].map((f) => [e, f, billing.passStatus(e, { renewalFailed: f })]));
    const codes = ["free", "starter", "plus", "pro"] as const;
    const pr = codes.flatMap((c) => codes.map((t) => [c, t, billing.prorate(c, t, "2026-10-10")]));
    const edge = ["2026-09-20", "2026-09-27", "2026-11-30"].map((e) => billing.prorate("starter", "pro", e));
    expect({ status, pr, edge }).toMatchSnapshot();
  });
  it("refund window and reminders", () => {
    const w = [0, 0.19, 0.2, 0.5].flatMap((u) => ["2026-09-19", "2026-09-20", "2026-09-10"].map((f) => [u, f, billing.refundWindow(f, u)]));
    expect({ w, reminder: billing.renewalReminderOn("2026-10-19") }).toMatchSnapshot();
  });
  it("checkout items and coupons", () => {
    const pass = [
      billing.passItem("plus", "free", "2026-10-10"),
      billing.passItem("pro", "starter", "2026-10-10"),
      billing.passItem("starter", "plus", "2026-10-10"),
      billing.packItem("pack_250"),
    ];
    const item = billing.passItem("plus", "free", "2026-10-10");
    const up = billing.passItem("pro", "starter", "2026-10-10");
    const coupons = [
      billing.applyCoupon("", item, { redeemed: [], hadPaidPass: false }),
      billing.applyCoupon("nope", item, { redeemed: [], hadPaidPass: false }),
      billing.applyCoupon("earlyaccess", billing.packItem("pack_100"), { redeemed: [], hadPaidPass: false }),
      billing.applyCoupon(" earlyaccess ", item, { redeemed: [], hadPaidPass: false }),
      billing.applyCoupon("EARLYACCESS", up, { redeemed: [], hadPaidPass: false }),
      billing.applyCoupon("EARLYACCESS", item, { redeemed: ["EARLYACCESS"], hadPaidPass: false }),
      billing.applyCoupon("EARLYACCESS", item, { redeemed: [], hadPaidPass: true }),
      billing.applyCoupon("EARLYACCESS", item, { redeemed: [], hadPaidPass: false, today: "2026-11-16" }),
    ];
    const totals = [billing.totalDue(item), billing.totalDue(up), billing.totalDue(up, coupons[4]), billing.totalDue(item, coupons[1])];
    expect({ pass, coupons, totals, statusLabels: billing.PASS_STATUS_LABEL }).toMatchSnapshot();
  });
});

describe("diagnosis rules", () => {
  it("scoring and diagnosis on the sample attempts", () => {
    const diag = getAttemptConfig(DIAGNOSTIC_ID)!;
    const retest = getAttemptConfig(RETEST_ID)!;
    const scoreD = diagnosis.scoreAttempt(diag, sampleDiagnosticResponses);
    const scoreR = diagnosis.scoreAttempt(retest, sampleRetestResponses);
    const findD = diagnosis.diagnose(diag.questionIds, sampleDiagnosticResponses);
    const findR = diagnosis.diagnose(retest.questionIds, sampleRetestResponses);
    expect({ scoreD, scoreR, findD, findR, compare: diagnosis.compareRetest(findD, findR) }).toMatchSnapshot();
  });
  it("mastery smoothing and answer checking", () => {
    const m = [[0, 3], [1, 3], [2, 3], [3, 3], [0, 0], [5, 5]].map(([c, t]) => [c, t, diagnosis.masteryFrom(c, t)]);
    expect({ m, labels: diagnosis.CATEGORY_LABEL }).toMatchSnapshot();
  });
  it("isCorrect on mcq and numerical questions", () => {
    const base = { id: "x", conceptId: "c" } as never;
    const mcq = { ...(base as object), type: "mcq", answer: "B" } as never;
    const num = { ...(base as object), type: "numerical", answer: "12.5", tolerance: 0.1 } as never;
    const noTol = { ...(base as object), type: "numerical", answer: "4" } as never;
    const out = [
      diagnosis.isCorrect(mcq, "B"), diagnosis.isCorrect(mcq, "b"), diagnosis.isCorrect(mcq, null), diagnosis.isCorrect(mcq, " "),
      diagnosis.isCorrect(num, "12.55"), diagnosis.isCorrect(num, "12.7"), diagnosis.isCorrect(num, "abc"), diagnosis.isCorrect(noTol, "4"), diagnosis.isCorrect(noTol, "4.01"),
    ];
    expect(out).toMatchSnapshot();
  });
});

describe("guardian rules", () => {
  it("age and dates", () => {
    const ages = ["2008-09-27", "2008-09-28", "2009-01-01", "2013-09-27", "2010-02-29"].map((dob) => [dob, guardian.ageOn(dob), guardian.isMinor(dob), guardian.adultOn(dob)]);
    const dates = [guardian.addDays("2026-09-27", 7), guardian.addDays("2026-12-30", 3), guardian.addBusinessDays("2026-10-02", 1), guardian.addBusinessDays("2026-09-27", 7), guardian.addBusinessDays("2026-09-30", 0)];
    expect({ ages, dates, TODAY, needsApproval: guardian.needsApproval }).toMatchSnapshot();
  });
  it("contact helpers and constants", () => {
    const mask = ["sunita@example.com", "a@b.c", "9876543210", "+91 98765 43210"].map((c) => guardian.maskContact(c));
    const valid = ["a@b.co", "a b@c.d", "x", " a@b.c "].map((v) => guardian.isEmail(v));
    const mobiles = ["9876543210", "+91 98765-43210", "12345", "5876543210", "919876543210"].map((v) => guardian.isIndianMobile(v));
    expect({
      mask, valid, mobiles, CONSENT: guardian.CONSENT, MIN: guardian.MIN_AGE, ADULT: guardian.ADULT_AGE, APPROVAL: guardian.APPROVAL_DAYS,
      see: guardian.GUARDIAN_CAN_SEE, cannot: guardian.GUARDIAN_CANNOT_SEE, terms: guardian.CONSENT_TERMS, token: guardian.PREVIEW_CONSENT_TOKEN, key: guardian.SIGNUP_KEY,
    }).toMatchSnapshot();
  });
});

describe("admin rules", () => {
  it("constants, breaker, reasons, adjustments", () => {
    const breaker = [[0, 1000], [199, 1000], [200, 1000], [299, 1000], [300, 1000], [5000, 100000], [10, 0]].map(([c, r]) => [c, r, admin.breakerState(c, r)]);
    const overrides = (["force_normal", "force_restricted"] as const).map((o) => admin.breakerState(500, 1000, admin.DEFAULT_BUDGET, o));
    const reasons = ["", "short", "         ", "long enough reason"].map((r) => admin.reasonError(r));
    const adj = [[0, 10], [1.5, 10], [501, 10], [-11, 10], [-10, 10], [500, 0]].map(([a, b]) => admin.adjustmentError(a, b));
    expect({ ADMIN: admin.ADMIN, breaker, overrides, reasons, adj, copy: admin.BREAKER_COPY, budget: admin.DEFAULT_BUDGET }).toMatchSnapshot();
  });
  it("cycle path, question lifecycle, refunds, formatting", () => {
    const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }];
    const cyc = [["d", "a"], ["a", "d"], ["a", "a"], ["c", "a"], ["x", "y"]].map(([f, t]) => admin.cyclePath(edges, f, t));
    const allPass = Object.fromEntries(admin.AUTOMATED_VALIDATORS.map((v) => [v, "pass"])) as never;
    const blockers = [
      admin.publishBlockers("draft", {}),
      admin.publishBlockers("published", allPass),
      admin.publishBlockers("validated", { ...(allPass as object), math: "fail", human: "pass" } as never),
      admin.publishBlockers("validated", { ...(allPass as object), human: "pass" } as never),
      admin.publishBlockers("reviewed", { ...(allPass as object), semantic: "pending" } as never),
    ];
    const refunds = [admin.refundCheck("2026-09-19", 0.1, "2026-09-27"), admin.refundCheck("2026-09-01", 0.5, "2026-09-27")];
    const stamps = [admin.stamp("2026-09-27T08:35:00Z"), admin.stamp("2026-12-31T20:00:00Z"), admin.istDay("2026-09-27T20:00:00Z"), admin.inrPrecise(1234.5), admin.pct(0.2345)];
    expect({ cyc, blockers, refunds, stamps, canSuspend: [admin.canSuspend("published"), admin.canSuspend("draft")], labels: [admin.VALIDATOR_LABEL, admin.QUESTION_STATUS_LABEL] }).toMatchSnapshot();
  });
});

describe("format helpers", () => {
  it("dates and durations", () => {
    expect({
      short: fmt.shortDate("2026-09-27"), dm: fmt.dayMonth("2026-12-01"), full: fmt.fullDate("2027-03-14"), wd: fmt.weekday("2026-09-27"),
      between: fmt.daysBetween("2026-09-27", "2026-10-27"), rel: ["2026-09-27", "2026-09-28", "2026-09-26", "2026-10-05"].map(fmt.relativeDay),
      ago: [null, "2026-09-27", "2026-09-26", "2026-09-20"].map(fmt.ago), clock: [0, 59, 1630].map(fmt.clock), dur: [0, 45, 160, 180].map(fmt.duration),
      inr: fmt.inr(1234567), signed: [5, -5, 0].map(fmt.signed),
    }).toMatchSnapshot();
  });
});
