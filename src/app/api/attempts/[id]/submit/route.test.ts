import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, exerciseQuestions, documents } = vi.hoisted(() => ({ db: vi.fn(), exerciseQuestions: vi.fn(), documents: new Map<string, Record<string, unknown>>() }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "student" }), ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: ApiError) => Response.json({ error: error.message }, { status: error.status }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/cached-content", () => ({ exerciseQuestions }));
vi.mock("@/lib/study-store", () => ({ qualifiedDay: () => null, studyDayRef: vi.fn() }));

import { POST } from "./route";

describe("batch grammar submission", () => {
  beforeEach(() => {
    documents.clear();
    documents.set("quizAttempts/attempt", { uid: "student", lessonId: "lesson", exerciseId: "exercise", questionIds: ["q1", "q2"], status: "in_progress", gradingMode: "batch", questionVersion: "v1" });
    exerciseQuestions.mockResolvedValue({ version: "v1", questions: [
      { id: "q1", question: "One ____", A: "a", B: "b", C: "c", D: "d", correctAnswer: "B", explanation: "Because" },
      { id: "q2", question: "Two ____", A: "a", B: "b", C: "c", D: "d", correctAnswer: "C", explanation: "Because" },
    ] });
    db.mockReturnValue({ collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, get: async () => ({ data: () => documents.get(`${name}/${id}`) }) }) }),
      runTransaction: async (task: (tx: unknown) => Promise<void>) => task({
        get: async (ref: { path: string }) => ({ data: () => documents.get(ref.path) }),
        create: (ref: { path: string }, value: Record<string, unknown>) => documents.set(ref.path, value),
        update: (ref: { path: string }, value: Record<string, unknown>) => documents.set(ref.path, { ...documents.get(ref.path), ...value }),
      }) });
  });
  const submit = (answers: unknown) => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ answers }) }), { params: Promise.resolve({ id: "attempt" }) });

  it("grades from server questions and saves every answer once", async () => {
    const response = await submit([{ questionId: "q1", selected: "B" }, { questionId: "q2", selected: "A" }]);
    expect(response.status).toBe(200);
    expect(documents.get("quizAttempts/attempt")).toMatchObject({ status: "complete", answeredCount: 2, correctCount: 1 });
    expect(documents.get("quizAnswers/attempt_q1")).toMatchObject({ correct: true, selected: "B" });
    expect((await submit([{ questionId: "q1", selected: "B" }, { questionId: "q2", selected: "A" }])).status).toBe(409);
  });

  it("rejects missing answers and a changed question set", async () => {
    expect((await submit([{ questionId: "q1", selected: "B" }])).status).toBe(400);
    exerciseQuestions.mockResolvedValueOnce({ version: "v2", questions: [] });
    expect((await submit([{ questionId: "q1", selected: "B" }, { questionId: "q2", selected: "C" }])).status).toBe(409);
    expect(documents.has("quizAnswers/attempt_q1")).toBe(false);
  });
});
