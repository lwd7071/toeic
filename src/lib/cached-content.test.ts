import { beforeEach, describe, expect, it, vi } from "vitest";

const { unstableCache, db, methods } = vi.hoisted(() => ({ unstableCache: vi.fn((fn: unknown, _key?: string[], _options?: unknown) => fn), db: vi.fn(), methods: [] as unknown[][] }));
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("./firebase-admin", () => ({ db }));

import { cachedTopics, cachedLessons, cachedListening, cachedCards } from "./cached-content";

describe("shared content cache", () => {
  beforeEach(() => {
    methods.length = 0;
    const query = {
      where(...args: unknown[]) { methods.push(["where", ...args]); return this; },
      orderBy(...args: unknown[]) { methods.push(["orderBy", ...args]); return this; },
      startAt(...args: unknown[]) { methods.push(["startAt", ...args]); return this; },
      endAt(...args: unknown[]) { methods.push(["endAt", ...args]); return this; },
      limit(...args: unknown[]) { methods.push(["limit", ...args]); return this; },
      get: async () => ({ size: 21, docs: Array.from({ length: 21 }, (_, i) => ({ id: `item${i}`, data: () => ({ title: `Item ${i}` }) })) }),
    };
    db.mockReturnValue({ collection: () => query });
  });

  it("caches only bounded shared pages under separate tags", async () => {
    const page = await cachedTopics(20, "", "CÔNG");
    expect(page.items).toHaveLength(20);
    expect(page.nextPageToken).toBe("item19");
    expect(methods).toContainEqual(["startAt", "công"]);
    expect(methods).toContainEqual(["limit", 21]);
    for (const [key, tag] of [["topics", "topics"], ["lessons", "lessons"], ["listening", "listening"], ["cards", "topics"], ["questions", "lessons"], ["listening-set", "listening"]]) {
      const call = unstableCache.mock.calls.find(call => (call[1] as string[])[1] === key);
      expect(call?.[2]).toEqual({ tags: [`content:${tag}`], revalidate: 900 });
    }
    expect(cachedLessons).toBeTypeOf("function");
    expect(cachedListening).toBeTypeOf("function");
  });

  it("filters listening sets before pagination and rejects a cursor from another type", async () => {
    await cachedListening(20, "", "picture");
    expect(methods).toContainEqual(["where", "kind", "==", "picture"]);
    expect(methods).toContainEqual(["limit", 21]);
    expect(methods.findIndex(method => method[0] === "where" && method[1] === "kind")).toBeLessThan(methods.findIndex(method => method[0] === "limit"));

    const collection = {
      where(...args: unknown[]) { methods.push(["where", ...args]); return this; },
      orderBy(...args: unknown[]) { methods.push(["orderBy", ...args]); return this; },
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ archivedAt: null, kind: "dictation" }) }) }),
    };
    db.mockReturnValue({ collection: () => collection });
    await expect(cachedListening(20, "other-set", "picture")).rejects.toThrow("Trang không hợp lệ.");
  });

  it("loads a whole vocabulary deck with one document read", async () => {
    const get = vi.fn(async () => ({ data: () => ({ title: "Topic", archivedAt: null, cards: [{ id: "card", english: "hello" }] }) }));
    db.mockReturnValue({ collection: (name: string) => {
      expect(name).toBe("vocabDecks");
      return { doc: (id: string) => { expect(id).toBe("topic"); return { get }; } };
    } });
    expect((await cachedCards("topic")).cards).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
