import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireViewer, cachedTopics, cachedLessons, db, collections } = vi.hoisted(() => ({
  requireViewer: vi.fn(), cachedTopics: vi.fn(), cachedLessons: vi.fn(), db: vi.fn(), collections: [] as string[],
}));
vi.mock("@/lib/auth", () => ({ requireViewer, ApiError }));
vi.mock("@/lib/api", () => ({ jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }) }));
vi.mock("@/lib/cached-content", () => ({ cachedTopics, cachedLessons }));
vi.mock("@/lib/firebase-admin", () => ({ db }));

import { GET } from "./route";

describe("home reads", () => {
  beforeEach(() => {
    vi.clearAllMocks(); collections.length = 0;
    cachedTopics.mockResolvedValue({ items: [{ id: "topic", title: "Topic", activeCount: 100 }] });
    cachedLessons.mockResolvedValue({ items: [{ id: "lesson", title: "Lesson", activeCount: 20 }] });
    db.mockReturnValue({
      collection: (name: string) => {
        collections.push(name);
        return {
          doc: (id: string) => ({ id, get: async () => ({ data: () => name === "userProgress" ? { review: id === "a" ? 2 : 5 } : { title: "Exercise" } }) }),
          where() { return this; }, orderBy() { return this; }, limit() { return this; },
          get: async () => ({ docs: [] }),
        };
      },
      getAll: async (...refs: { id: string }[]) => refs.map(ref => ({ data: () => ({ remembered: ref.id.startsWith("a_") ? 3 : 7, review: 1 }) })),
    });
  });

  it("uses shared small pages but reads progress per learner", async () => {
    requireViewer.mockResolvedValueOnce({ uid: "a" }).mockResolvedValueOnce({ uid: "b" });
    const first = await (await GET()).json();
    const second = await (await GET()).json();
    expect(cachedTopics).toHaveBeenCalledWith(3, "", "");
    expect(cachedLessons).toHaveBeenCalledWith(3, "");
    expect(first.topics[0].remembered).toBe(3);
    expect(second.topics[0].remembered).toBe(7);
    expect(first.reviewTotal).toBe(2);
    expect(second.reviewTotal).toBe(5);
    expect(collections).not.toContain("vocabCards");
    expect(collections).not.toContain("grammarQuestions");
  });
});
