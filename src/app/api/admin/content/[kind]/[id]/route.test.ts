import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, revalidateTag, updates, deletes, creates, docs } = vi.hoisted(() => ({
  db: vi.fn(),
  revalidateTag: vi.fn(),
  updates: [] as { path: string; value: Record<string, unknown> }[],
  deletes: [] as string[],
  creates: [] as string[],
  docs: new Map<string, Record<string, unknown>>(),
}));
vi.mock("@/lib/auth", () => ({ requireContentEditor: async () => ({ isBot: false }), ApiError }));
vi.mock("@/lib/api", () => ({
  requireCsrf: async () => {},
  nullableArchive: (value: boolean) => value ? "archived" : null,
  textField: (value: unknown) => String(value).trim(),
  jsonError: (error: Error) => Response.json({ error: error.message }, { status: 500 }),
}));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: (value: number) => ({ increment: value }) } }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { PATCH } from "./route";

describe("archive counters", () => {
  beforeEach(() => {
    vi.clearAllMocks(); updates.length = 0; deletes.length = 0; creates.length = 0; docs.clear();
    const store = {
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, get: async () => ({ exists: docs.has(`${name}/${id}`), data: () => docs.get(`${name}/${id}`) }) }) }),
      runTransaction: async (task: (tx: unknown) => Promise<unknown>) => task({
        get: async (ref: { path: string }) => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path) }),
        update: (ref: { path: string }, value: Record<string, unknown>) => updates.push({ path: ref.path, value }),
        delete: (ref: { path: string }) => deletes.push(ref.path),
        create: (ref: { path: string }) => creates.push(ref.path),
      }),
    };
    db.mockReturnValue(store);
  });

  const archive = (kind: string, id: string) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ archive: true }) }), { params: Promise.resolve({ kind, id }) });

  it("decrements exercise and active lesson question counts", async () => {
    docs.set("grammarQuestions/q", { exerciseId: "e", lessonId: "l", archivedAt: null });
    docs.set("grammarExercises/e", { archivedAt: null });
    docs.set("grammarLessons/l", { archivedAt: null });
    expect((await archive("question", "q")).status).toBe(200);
    expect(updates).toContainEqual({ path: "grammarExercises/e", value: { activeCount: { increment: -1 } } });
    expect(updates).toContainEqual({ path: "grammarLessons/l", value: { activeCount: { increment: -1 } } });
    expect(revalidateTag).toHaveBeenCalledWith("content:lessons");
  });

  it("removes an archived exercise's active questions from the lesson", async () => {
    docs.set("grammarExercises/e", { lessonId: "l", activeCount: 6, archivedAt: null });
    docs.set("grammarLessons/l", { archivedAt: null });
    expect((await archive("exercise", "e")).status).toBe(200);
    expect(updates).toContainEqual({ path: "grammarLessons/l", value: { activeCount: { increment: -6 } } });
  });

  it("uses live card key inside transaction when deleting old uniqueKeys marker", async () => {
    const { normalizedKey, uniqueId } = await import("@/lib/csv-import");
    const staleKey = normalizedKey("cat", "mèo");
    const liveKey = normalizedKey("dog", "chó");
    docs.set("vocabCards/c1", { topicId: "t1", english: "cat", vietnamese: "mèo", key: staleKey, archivedAt: null });
    docs.set("vocabDecks/t1", { title: "Topic", archivedAt: null, cards: [{ id: "c1", english: "dog", vietnamese: "chó", key: liveKey, archivedAt: null }] });
    // Giả lập card bị cập nhật đồng thời trước khi transaction chạy
    const store = db();
    const origTx = store.runTransaction;
    store.runTransaction = async (task: (tx: unknown) => Promise<unknown>) => {
      docs.set("vocabCards/c1", { topicId: "t1", english: "dog", vietnamese: "chó", key: liveKey, archivedAt: null });
      return origTx(task);
    };
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ english: "bird", vietnamese: "chim" }) }),
      { params: Promise.resolve({ kind: "card", id: "c1" }) },
    );
    expect(res.status).toBe(200);
    expect(deletes).toEqual([`uniqueKeys/${uniqueId("cards", "t1", liveKey)}`]);
  });
});
