import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, queries, transactionReads } = vi.hoisted(() => ({
  db: vi.fn(),
  queries: [] as { field: string; operator: string; value: unknown }[][],
  transactionReads: [] as unknown[],
}));
vi.mock("@/lib/auth", () => ({ requireContentEditor: async () => ({}), ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: Error) => Response.json({ error: error.message }, { status: 400 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: (value: number) => value } }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST, PUT } from "./route";

describe("listening import reads", () => {
  beforeEach(() => {
    vi.clearAllMocks(); queries.length = 0; transactionReads.length = 0;
    const collection = (name: string) => ({
      doc: (id?: string) => ({ id, name, get: async () => ({ data: () => ({ kind: "dictation", archivedAt: null }) }) }),
      where: (field: string, operator: string, value: unknown) => {
        const filters = [{ field, operator, value }];
        const query = {
          filters,
          where(nextField: string, nextOperator: string, nextValue: unknown) { filters.push({ field: nextField, operator: nextOperator, value: nextValue }); return this; },
          get: async () => ({ docs: [], empty: true }),
        };
        queries.push(filters);
        return query;
      },
    });
    db.mockReturnValue({
      collection,
      runTransaction: async (task: (tx: unknown) => Promise<unknown>) => task({
        get: async (ref: { filters?: unknown }) => { transactionReads.push(ref); return ref.filters ? { docs: [], empty: true } : { exists: true, data: () => ({ archivedAt: null }) }; },
        create: vi.fn(), update: vi.fn(),
      }),
    });
  });

  const csv = "audio_url,transcript\nhttps://drive.google.com/file/d/abcdefghij/view,hello";
  const form = (hash?: string) => {
    const data = new FormData(); data.set("setId", "set-1"); data.set("file", new File([csv], "items.csv"));
    if (hash) data.set("expectedHash", hash);
    return data;
  };

  it("checks only CSV media keys during preview and commit", async () => {
    const preview = await POST(new Request("http://localhost", { method: "POST", body: form() }));
    expect(preview.status).toBe(200);
    const { hash } = await preview.json();
    const commit = await PUT(new Request("http://localhost", { method: "PUT", body: form(hash) }));
    expect(commit.status).toBe(200);
    expect(queries).toHaveLength(2);
    for (const filters of queries) expect(filters).toEqual([
      { field: "setId", operator: "==", value: "set-1" },
      { field: "key", operator: "in", value: ["\u0000https://drive.google.com/file/d/abcdefghij/view"] },
    ]);
    expect(transactionReads).toHaveLength(2);
  });
});
