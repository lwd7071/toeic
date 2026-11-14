import { beforeEach, describe, expect, it, vi } from "vitest";

const { unstableCache, db, methods } = vi.hoisted(() => ({ unstableCache: vi.fn((fn: unknown, _key?: string[], _options?: unknown) => fn), db: vi.fn(), methods: [] as unknown[][] }));
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("./firebase-admin", () => ({ db }));

import { cachedTopics, cachedLessons, cachedListening } from "./cached-content";

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
    expect(unstableCache.mock.calls.map(call => call[2])).toEqual([
      { tags: ["content:topics"], revalidate: 900 },
      { tags: ["content:lessons"], revalidate: 900 },
      { tags: ["content:listening"], revalidate: 900 },
    ]);
    expect(cachedLessons).toBeTypeOf("function");
    expect(cachedListening).toBeTypeOf("function");
  });
});
