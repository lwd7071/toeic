import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, documents } = vi.hoisted(() => ({ db: vi.fn(), documents: new Map<string, Record<string, unknown>>() }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "student" }), ApiError }));
vi.mock("@/lib/api", () => ({ requireCsrf: async () => {}, jsonError: (error: ApiError) => Response.json({ error: error.message }, { status: error.status }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));
vi.mock("@/lib/study-store", () => ({ qualifiedDay: () => null, studyDayRef: vi.fn() }));

import { POST } from "./route";

describe("answer grammar questions in any order", () => {
  beforeEach(() => {
    documents.clear();
    documents.set("quizAttempts/attempt", { uid: "student", lessonId: "lesson", exerciseId: "exercise", questionIds: ["q1", "q2"], answeredCount: 0, correctCount: 0, status: "in_progress" });
    documents.set("grammarQuestions/q1", { question: "One ____", A: "a", B: "b", C: "c", D: "d", correctAnswer: "A", explanation: "First" });
    documents.set("grammarQuestions/q2", { question: "Two ____", A: "a", B: "b", C: "c", D: "d", correctAnswer: "B", explanation: "Second" });
    let queue = Promise.resolve();
    db.mockReturnValue({
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
      runTransaction: (task: (tx: unknown) => Promise<unknown>) => {
        const run = queue.then(() => task({
          get: async (ref: { path: string }) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) }),
          create: (ref: { path: string }, value: Record<string, unknown>) => documents.set(ref.path, value),
          update: (ref: { path: string }, value: Record<string, unknown>) => documents.set(ref.path, { ...documents.get(ref.path), ...value }),
        }));
        queue = run.then(() => {}, () => {});
        return run;
      },
    });
  });

  const answer = (questionId: string, selected: string) => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ questionId, selected }) }), { params: Promise.resolve({ id: "attempt" }) });

  it("accepts the last question first, then finishes after the remaining question", async () => {
    const first = await (await answer("q2", "A")).json();
    expect(first).toMatchObject({ answeredCount: 1, correctCount: 0, complete: false, answer: { questionId: "q2", correct: false } });
    const second = await (await answer("q1", "A")).json();
    expect(second).toMatchObject({ answeredCount: 2, correctCount: 1, complete: true });
    expect(documents.get("quizAttempts/attempt")).toMatchObject({ status: "complete", answeredCount: 2, correctCount: 1 });
  });

  it("treats a repeated choice as idempotent and rejects a changed choice or foreign question", async () => {
    await answer("q2", "B");
    expect((await answer("q2", "B")).status).toBe(200);
    expect((await answer("q2", "A")).status).toBe(409);
    expect((await answer("outside", "A")).status).toBe(409);
    expect(documents.get("quizAttempts/attempt")?.answeredCount).toBe(1);
  });

  it("counts two different requests without losing an answer", async () => {
    const responses = await Promise.all([answer("q1", "A"), answer("q2", "B")]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(documents.get("quizAttempts/attempt")).toMatchObject({ answeredCount: 2, correctCount: 2, status: "complete" });
  });
});
