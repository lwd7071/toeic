import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { requireViewer, requireCsrf, db, documents, questions, addAttempt } = vi.hoisted(() => ({
  requireViewer: vi.fn(), requireCsrf: vi.fn(), db: vi.fn(), documents: new Map<string, unknown>(), questions: vi.fn(), addAttempt: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireViewer, ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf, jsonError: (error: ApiError) => Response.json({ error: error.message }, { status: error.status }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/cached-content", () => ({
  cachedLesson: async (id: string) => ({ id, ...documents.get(`grammarLessons/${id}`) as object }),
  cachedExercise: async (id: string) => ({ id, ...documents.get(`grammarExercises/${id}`) as object }),
  exerciseQuestions: async (id: string) => ({ questions: questions(id).map((q: { id: string; data: () => object }) => ({ id: q.id, ...q.data() })), version: "v1" }),
}));

import { POST } from "./route";

describe("start grammar exercise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents.clear();
    requireViewer.mockResolvedValue({ uid: "student" });
    requireCsrf.mockResolvedValue(undefined);
    documents.set("grammarLessons/lesson", { archivedAt: null });
    documents.set("grammarExercises/a", { lessonId: "lesson", archivedAt: null });
    documents.set("grammarExercises/b", { lessonId: "lesson", archivedAt: null });
    questions.mockImplementation((id: string) => id === "a" ? [
      { id: "a1", data: () => ({ lessonId: "lesson", exerciseId: "a", archivedAt: null, createdAt: "1" }) },
      { id: "a2", data: () => ({ lessonId: "lesson", exerciseId: "a", archivedAt: null, createdAt: "2" }) },
    ] : [{ id: "b1", data: () => ({ lessonId: "lesson", exerciseId: "b", archivedAt: null, createdAt: "1" }) }]);
    addAttempt.mockResolvedValue({ id: "attempt" });
    db.mockReturnValue({ collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => ({ exists: documents.has(`${name}/${id}`), data: () => documents.get(`${name}/${id}`) }) }),
      where: (_field: string, _op: string, id: string) => ({ get: async () => ({ docs: questions(id) }) }),
      add: addAttempt,
    }) });
  });

  const start = (exerciseId: string) => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ exerciseId }) }), { params: Promise.resolve({ id: "lesson" }) });

  it("starts with only the selected exercise's questions", async () => {
    expect((await start("a")).status).toBe(200);
    expect(addAttempt.mock.calls[0][0]).toMatchObject({ lessonId: "lesson", exerciseId: "a", questionIds: ["a1", "a2"] });
    expect((await start("b")).status).toBe(200);
    expect(addAttempt.mock.calls[1][0].questionIds).toEqual(["b1"]);
  });

  it("rejects an archived or foreign exercise", async () => {
    documents.set("grammarExercises/a", { lessonId: "lesson", archivedAt: "2026-01-01" });
    expect((await start("a")).status).toBe(404);
    documents.set("grammarExercises/a", { lessonId: "other", archivedAt: null });
    expect((await start("a")).status).toBe(404);
    expect(addAttempt).not.toHaveBeenCalled();
  });

  it("starts practice only from its default exercise and rejects an empty set", async () => {
    documents.set("grammarLessons/lesson", { kind: "practice", archivedAt: null });
    documents.set("grammarExercises/default_lesson", { lessonId: "lesson", archivedAt: null });
    expect((await start("a")).status).toBe(404);
    questions.mockReturnValueOnce([]);
    expect((await start("default_lesson")).status).toBe(400);
    questions.mockReturnValueOnce([{ id: "q", data: () => ({ lessonId: "lesson", exerciseId: "default_lesson", archivedAt: null }) }]);
    expect((await start("default_lesson")).status).toBe(200);
    expect(addAttempt.mock.calls[0][0]).toMatchObject({ lessonKind: "practice", exerciseId: "default_lesson", questionIds: ["q"] });
  });
});
