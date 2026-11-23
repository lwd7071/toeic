import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getAll, reads, creates, matched } = vi.hoisted(() => ({ db: vi.fn(), getAll: vi.fn(), reads: [] as string[], creates: [] as string[], matched: [] as string[] }));
vi.mock("@/lib/auth", () => ({ requireContentEditor: async () => ({}), ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: Error & { status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 500 }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("firebase-admin/firestore", () => ({ FieldPath: { documentId: () => "__name__" }, FieldValue: { increment: (value: number) => value } }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST, PUT } from "./route";

describe("content import reads", () => {
  beforeEach(() => {
    vi.clearAllMocks(); reads.length = 0; creates.length = 0; matched.length = 0;
    db.mockReturnValue({
      collection: (name: string) => ({ doc: (id = "generated") => ({ id, path: `${name}/${id}`, get: async () => ({ exists: true, data: () => ({ archivedAt: null }) }) }),
        where: (_field: unknown, _op: string, ids: string[]) => ({ get: async () => ({ docs: ids.filter(id => matched.includes(id)).map(id => ({ id })) }) }) }),
      getAll,
      runTransaction: async (task: (tx: unknown) => Promise<unknown>) => task({
        get: async (ref: { path: string }) => { reads.push(ref.path); return { exists: true, data: () => ref.path.startsWith("vocabDecks/") ? { title: "Topic", archivedAt: null, cards: [] } : { archivedAt: null } }; },
        create: (ref: { path: string }) => creates.push(ref.path), update: vi.fn(),
      }),
    });
    getAll.mockResolvedValue([{ exists: false }]);
  });

  const csv = "english,vietnamese\nhello,xin chào";
  const form = (hash?: string) => {
    const data = new FormData(); data.set("kind", "cards"); data.set("parentId", "topic-1"); data.set("file", new File([csv], "cards.csv"));
    if (hash) data.set("expectedHash", hash);
    return data;
  };

  it("reads duplicate markers for preview but uses create preconditions on commit", async () => {
    const preview = await POST(new Request("http://localhost", { method: "POST", body: form() }));
    expect(preview.status).toBe(200);
    const { hash } = await preview.json();
    const commit = await PUT(new Request("http://localhost", { method: "PUT", body: form(hash) }));
    expect(commit.status).toBe(200);
    expect(getAll).not.toHaveBeenCalled();
    expect(reads).toEqual(["vocabTopics/topic-1", "vocabDecks/topic-1"]);
    expect(creates.some(path => path.startsWith("uniqueKeys/"))).toBe(true);
  });

  it("reports a concurrent duplicate as a conflict", async () => {
    const preview = await POST(new Request("http://localhost", { method: "POST", body: form() }));
    const { hash } = await preview.json();
    db().runTransaction = async () => { throw Object.assign(new Error("already exists"), { code: 6 }); };
    const commit = await PUT(new Request("http://localhost", { method: "PUT", body: form(hash) }));
    expect(commit.status).toBe(409);
    expect((await commit.json()).error).toContain("Hãy xem trước lại");
  });

  it("reports duplicate markers returned by a grouped preview query", async () => {
    const { uniqueId, normalizedKey } = await import("@/lib/csv-import");
    matched.push(uniqueId("cards", "topic-1", normalizedKey("hello", "xin chào")));
    const response = await POST(new Request("http://localhost", { method: "POST", body: form() }));
    expect((await response.json()).errors).toContain("Dòng 2: nội dung đã có trong bài/chủ đề (có thể đang bị ẩn).");
  });

  it("keeps original CSV line numbers when an earlier row has a format error", async () => {
    const { uniqueId, normalizedKey } = await import("@/lib/csv-import");
    matched.push(uniqueId("cards", "topic-1", normalizedKey("hello", "xin chào")));
    const data = new FormData();
    data.set("kind", "cards");
    data.set("parentId", "topic-1");
    data.set("file", new File(["english,vietnamese\ninvalid_row\nhello,xin chào"], "cards.csv"));
    const response = await POST(new Request("http://localhost", { method: "POST", body: data }));
    expect((await response.json()).errors).toEqual([
      "Dòng 2: cần đúng 2 cột.",
      "Dòng 3: nội dung đã có trong bài/chủ đề (có thể đang bị ẩn).",
    ]);
  });
});
