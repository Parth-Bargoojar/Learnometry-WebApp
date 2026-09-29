import { afterEach, describe, expect, it } from "vitest";
import {
  addBusinessDays,
  ageOn,
  endOfIstDay,
  endOfIstMonth,
  isBusinessDay,
  istDate,
  istDaysBetween,
  istMonth,
  now,
  setClock,
  startOfIstDay,
  startOfIstMonth,
} from "./time";

afterEach(() => setClock());

describe("IST helpers", () => {
  it("reads the IST date across the UTC boundary", () => {
    // 18:30 UTC on 30 Sep is 00:00 IST on 1 Oct.
    expect(istDate(new Date("2026-09-30T18:29:59Z"))).toBe("2026-09-30");
    expect(istDate(new Date("2026-09-30T18:30:00Z"))).toBe("2026-10-01");
  });

  it("finds day and month edges", () => {
    const d = new Date("2026-09-30T10:00:00Z");
    expect(startOfIstDay(d).toISOString()).toBe("2026-09-29T18:30:00.000Z");
    expect(endOfIstDay(d).toISOString()).toBe("2026-09-30T18:29:59.000Z");
    expect(endOfIstMonth(d).toISOString()).toBe("2026-09-30T18:29:59.000Z");
    expect(startOfIstMonth(d).toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(istMonth(d)).toBe("2026-09");
  });

  it("handles a leap-year February end", () => {
    expect(endOfIstMonth(new Date("2028-02-10T00:00:00Z")).toISOString()).toBe("2028-02-29T18:29:59.000Z");
  });

  it("counts calendar days, not 24-hour blocks", () => {
    expect(istDaysBetween(new Date("2026-09-30T18:00:00Z"), new Date("2026-09-30T19:00:00Z"))).toBe(1);
    expect(istDaysBetween(new Date("2026-09-30T02:00:00Z"), new Date("2026-09-30T17:00:00Z"))).toBe(0);
  });

  it("skips weekends when adding business days", () => {
    const friday = new Date("2026-10-02T06:00:00Z"); // Fri 2 Oct 2026, IST
    expect(isBusinessDay(friday)).toBe(true);
    expect(istDate(addBusinessDays(friday, 1))).toBe("2026-10-05"); // Monday
    expect(istDate(addBusinessDays(friday, 7))).toBe("2026-10-13");
    expect(addBusinessDays(friday, 0)).toEqual(friday);
  });

  it("computes age by IST calendar date", () => {
    const at = new Date("2026-09-30T00:00:00Z");
    expect(ageOn("2008-09-30", at)).toBe(18);
    expect(ageOn("2008-10-01", at)).toBe(17);
    expect(ageOn("2008-09-29", at)).toBe(18);
  });

  it("uses the injected clock", () => {
    setClock(() => new Date("2026-01-01T00:00:00Z"));
    expect(now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
    setClock();
    expect(now().getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
