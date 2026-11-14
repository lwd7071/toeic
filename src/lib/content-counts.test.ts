import { describe, expect, it } from "vitest";
import { countChange, searchTitle } from "./content-counts";

describe("content counters", () => {
  it("tracks creation, archive, restore and permanent deletion", () => {
    const active = { archivedAt: null }, archived = { archivedAt: "2026-11-14" };
    expect(countChange(null, active)).toEqual({ totalCount: 1, activeCount: 1 });
    expect(countChange(active, archived)).toEqual({ totalCount: 0, activeCount: -1 });
    expect(countChange(archived, active)).toEqual({ totalCount: 0, activeCount: 1 });
    expect(countChange(active, null)).toEqual({ totalCount: -1, activeCount: -1 });
    expect(countChange(archived, null)).toEqual({ totalCount: -1, activeCount: 0 });
  });
  it("normalizes Vietnamese prefix searches", () => {
    expect(searchTitle("  CÔNG SỞ  ")).toBe("công sở");
  });
});
