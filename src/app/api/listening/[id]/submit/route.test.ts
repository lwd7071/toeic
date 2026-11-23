import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, cachedListeningSet, batches } = vi.hoisted(() => ({
  db: vi.fn(),
  cachedListeningSet: vi.fn(),
  batches: [] as { writes: number; committed: boolean }[],
}));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "user-1" }), ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: Error & { status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/cached-content", () => ({ cachedListeningSet }));

import { POST } from "./route";

describe("listening submit batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batches.length = 0;
    db.mockReturnValue({
      collection: (name: string) => ({
        doc: (id = "auto") => ({ id, path: `${name}/${id}`, collection: () => ({ doc: (d: string) => ({ path: `${name}/${id}/days/${d}` }) }) }),
      }),
      batch: () => {
        const entry = { writes: 0, committed: false };
        batches.push(entry);
        return {
          create: () => { entry.writes++; },
          set: () => { entry.writes++; },
          commit: async () => { entry.committed = true; },
        };
      },
    });
  });

  it("splits Firestore WriteBatch when submitting more than 450 answers", async () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `item-${i}`,
      setId: "set-1",
      audioUrl: "https://drive.google.com/file/d/abcdefghij/view",
      transcript: `hello ${i}`,
      key: `k-${i}`,
      archivedAt: null,
      createdAt: `2026-11-01T00:00:${String(i).padStart(4, "0")}Z`,
    }));
    cachedListeningSet.mockResolvedValue({
      set: { title: "Big Set", kind: "dictation", archivedAt: null },
      items,
    });
    const responses = items.map(item => ({ id: item.id, selected: item.transcript }));
    const res = await POST(
      new Request("http://localhost/api/listening/set-1/submit", { method: "POST", body: JSON.stringify({ responses }) }),
      { params: Promise.resolve({ id: "set-1" }) },
    );
    expect(res.status).toBe(200);
    expect(batches).toHaveLength(2);
    expect(batches.every(b => b.committed && b.writes <= 500)).toBe(true);
    expect(batches[0].writes).toBe(452); // 1 attempt + 1 studyDay + 450 answers
    expect(batches[1].writes).toBe(50);  // 50 remaining answers
  });
});
