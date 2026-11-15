import { describe, expect, it, vi } from "vitest";
import { previousDate } from "./study-days";

const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
import { studyDays } from "./study-store";

describe("bounded study calendar reads", () => {
  it("reads one month and continues a streak beyond the first 32-day page", async () => {
    const previousStart = process.env.STUDY_TRACKING_START_DATE;
    process.env.STUDY_TRACKING_START_DATE = "2026-01-01";
    const dates = Array.from({ length: 40 }, (_, i) => { let day = "2026-11-15"; for (let n = 0; n < i; n++) day = previousDate(day); return day; });
    const limits: number[] = [];
    const query = (descending = false, from = "", until = "") => ({
      orderBy: (_field: unknown, direction?: string) => query(direction === "desc", from, until),
      startAt: (value: string) => query(descending, value, until),
      endBefore: (value: string) => query(descending, from, value),
      startAfter: (doc: { id: string }) => query(descending, from, doc.id),
      limit: (value: number) => { limits.push(value); return query(descending, from, until); },
      get: async () => ({ docs: (descending ? dates.filter(day => day <= from && (!until || day < until)) : dates.filter(day => day >= from && day < until).sort()).slice(0, descending ? 32 : undefined).map(id => ({ id })) }),
    });
    db.mockReturnValue({ collection: () => ({ doc: () => ({ collection: () => query() }) }) });
    const result = await studyDays("student", "2026-11", "2026-11-15");
    expect(result.streak).toBe(40);
    expect(result.studiedToday).toBe(true);
    expect(result.days).toEqual(dates.filter(day => day.startsWith("2026-11")).sort());
    expect(limits).toEqual([32, 32]);
    if (previousStart === undefined) delete process.env.STUDY_TRACKING_START_DATE;
    else process.env.STUDY_TRACKING_START_DATE = previousStart;
  });
});
