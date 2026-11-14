import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const { db, requested } = vi.hoisted(() => ({ db: vi.fn(), requested: [] as string[] }));
vi.mock("@/lib/auth", () => ({ requireViewer: async () => ({ uid: "student" }), ApiError }));
vi.mock("@/lib/api", () => ({ jsonError: (error: ApiError) => Response.json({ error: error.message }, { status: error.status }) }));
vi.mock("@/lib/firebase-admin", () => ({ db }));

import { GET } from "./route";

describe("grammar attempt questions", () => {
  it("returns all prompts in order without unrevealed answers and reads only unanswered questions", async () => {
    requested.length = 0;
    const snapshot = { question: "First ____", A: "one", B: "two", C: "three", D: "four", correctAnswer: "B", explanation: "Reason" };
    const documents: Record<string, Record<string, unknown>> = {
      "quizAttempts/attempt": { uid: "student", lessonId: "lesson", exerciseId: "exercise", questionIds: ["q1", "q2"], status: "in_progress", answeredCount: 1, correctCount: 0 },
      "grammarExercises/exercise": { title: "Practice" },
      "grammarQuestions/q2": { question: "Second ____", A: "a", B: "b", C: "c", D: "d", correctAnswer: "D", explanation: "Hidden" },
    };
    const answer = { questionId: "q1", selected: "A", correct: false, snapshot };
    db.mockReturnValue({
      collection: (name: string) => ({
        doc: (id: string) => ({ id, path: `${name}/${id}`, get: async () => ({ data: () => documents[`${name}/${id}`] }) }),
        where: () => ({ get: async () => ({ docs: [{ data: () => answer }] }) }),
      }),
      getAll: async (...refs: { id: string; path: string }[]) => refs.map(ref => { requested.push(ref.path); return { id: ref.id, data: () => documents[ref.path] }; }),
    });
    const response = await GET(new Request("http://localhost/api/attempts/attempt"), { params: Promise.resolve({ id: "attempt" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(requested).toEqual(["grammarQuestions/q2"]);
    expect(body.questions.map((question: { id: string }) => question.id)).toEqual(["q1", "q2"]);
    expect(body.questions[1]).toEqual({ id: "q2", question: "Second ____", A: "a", B: "b", C: "c", D: "d" });
    expect(JSON.stringify(body.questions)).not.toContain("Hidden");
    expect(JSON.stringify(body.questions)).not.toContain("correctAnswer");
    expect(body.answers[0].snapshot.correctAnswer).toBe("B");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
