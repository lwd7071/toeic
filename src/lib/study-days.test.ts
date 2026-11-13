import { describe, expect, it } from "vitest";
import { currentStreak, vietnamDate } from "./study-days";

describe("daily study streak", () => {
  it("switches to the next day at midnight in Vietnam", () => {
    expect(vietnamDate(new Date("2026-11-13T16:59:59Z"))).toBe("2026-11-13");
    expect(vietnamDate(new Date("2026-11-13T17:00:00Z"))).toBe("2026-11-14");
  });

  it("counts each day once, holds yesterday's streak today, and resets after a missed day", () => {
    const days = ["2026-11-11", "2026-11-12", "2026-11-12"];
    expect(currentStreak(days, "2026-11-12")).toBe(2);
    expect(currentStreak(days, "2026-11-13")).toBe(2);
    expect(currentStreak(days, "2026-11-14")).toBe(0);
    expect(currentStreak([], "2026-11-13")).toBe(0);
  });
});
