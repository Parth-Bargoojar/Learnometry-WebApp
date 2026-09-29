import { describe, expect, it } from "vitest";
import { abuseSignal, adjustmentError, breakerState, canSuspend, cyclePath, publishBlockers, reasonError, refundCheck, stamp } from "./rules";

describe("abuseSignal (ALG §12)", () => {
  it("flags 7 consecutive days above 80%", () => {
    expect(abuseSignal([0.81, 0.9, 0.85, 0.99, 0.82, 0.83, 1])).toBe(true);
    expect(abuseSignal([0.1, 0.81, 0.9, 0.85, 0.99, 0.82, 0.83, 1])).toBe(true);
  });
  it("does not flag short history, a dip, or exactly 80%", () => {
    expect(abuseSignal([0.9, 0.9, 0.9])).toBe(false);
    expect(abuseSignal([0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9])).toBe(false);
    expect(abuseSignal([0.8, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9])).toBe(false);
  });
});

describe("breakerState (K8, ALG §12)", () => {
  it("uses ratio thresholds and the ₹5,000 hard cap", () => {
    expect(breakerState(199, 1000).state).toBe("normal");
    expect(breakerState(200, 1000).state).toBe("warning");
    expect(breakerState(300, 1000).state).toBe("restricted");
    expect(breakerState(5000, 1_000_000).state).toBe("restricted");
  });
  it("applies only the hard cap when there is no revenue history", () => {
    expect(breakerState(10, 0).state).toBe("normal");
    expect(breakerState(4999, 0).state).toBe("normal");
    expect(breakerState(5000, 0).state).toBe("restricted");
  });
  it("honours operator overrides", () => {
    expect(breakerState(500, 1000, undefined, "force_normal")).toMatchObject({ state: "normal", overridden: true });
    expect(breakerState(1, 1000, undefined, "force_restricted")).toMatchObject({ state: "restricted", overridden: true });
  });
});

describe("console rules", () => {
  it("validates reasons, adjustments and question lifecycle", () => {
    expect(reasonError("too short")).not.toBeNull();
    expect(reasonError("a proper reason")).toBeNull();
    expect(adjustmentError(0, 5)).not.toBeNull();
    expect(adjustmentError(501, 5)).toContain("500");
    expect(adjustmentError(-6, 5)).toContain("below 0");
    expect(adjustmentError(-5, 5)).toBeNull();
    expect(publishBlockers("published", {})).toEqual(["Already published."]);
    expect(publishBlockers("draft", {}).length).toBe(2);
    expect(canSuspend("published")).toBe(true);
  });

  it("finds cycles and formats IST stamps", () => {
    expect(cyclePath([{ from: "a", to: "b" }], "b", "a")).toEqual(["a", "b"]);
    expect(cyclePath([], "a", "b")).toBeNull();
    expect(stamp("2026-09-27T08:35:00Z")).toBe("27 Sep, 14:05");
    expect(refundCheck("2026-09-20", 0.1, "2026-09-27").eligible).toBe(true);
  });
});
