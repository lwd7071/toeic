import { describe, expect, it } from "vitest";
import { firestorePage, pageToken } from "./pagination";

describe("pagination", () => {
  it("returns 20 rows and the last visible document as cursor", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ id: `row${i}` }));
    const query = {
      orderBy: () => query,
      startAfter: () => query,
      limit: (count: number) => ({ get: async () => ({ docs: rows.slice(0, count) }) }),
    };
    const page = await firestorePage(query as unknown as FirebaseFirestore.Query, "");
    expect(page.docs).toHaveLength(20);
    expect(page.nextPageToken).toBe("row19");
  });

  it("rejects malformed tokens", () => {
    expect(pageToken(new Request("http://localhost?pages=1"))).toBe("");
    expect(() => pageToken(new Request("http://localhost?pageToken=bad%2Ftoken"))).toThrow();
  });
});
