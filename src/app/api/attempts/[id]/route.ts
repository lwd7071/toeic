import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { Answer, Attempt, Question } from "@/lib/models";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const doc = await store.collection("quizAttempts").doc(id).get();
    const attempt = doc.data() as Attempt | undefined;
    if (!attempt || attempt.uid !== user.uid) throw new ApiError(404, "Không tìm thấy lượt làm bài.");
    const exerciseId = attempt.exerciseId ?? `default_${attempt.lessonId}`;
    const [answerSnap, exercise] = await Promise.all([
      store.collection("quizAnswers").where("attemptId", "==", id).get(),
      store.collection("grammarExercises").doc(exerciseId).get(),
    ]);
    const saved = new Map(answerSnap.docs.map(doc => { const answer = doc.data() as Answer; return [answer.questionId, answer] as const; }));
    const unansweredIds = attempt.questionIds.filter(questionId => !saved.has(questionId));
    const questionDocs = unansweredIds.length ? await store.getAll(...unansweredIds.map(questionId => store.collection("grammarQuestions").doc(questionId))) : [];
    const unanswered = new Map(questionDocs.map(doc => [doc.id, doc.data() as Question | undefined]));
    const questions = attempt.questionIds.map(questionId => {
      const answer = saved.get(questionId);
      const source = answer?.snapshot ?? unanswered.get(questionId);
      if (!source) throw new ApiError(409, "Một câu hỏi của lượt này không còn tồn tại.");
      return { id: questionId, question: source.question, A: source.A, B: source.B, C: source.C, D: source.D };
    });
    const answers = attempt.questionIds.flatMap(questionId => {
      const answer = saved.get(questionId);
      return answer ? [{ questionId, selected: answer.selected, correct: answer.correct, snapshot: answer.snapshot }] : [];
    });
    return Response.json({ attempt: { id, lessonId: attempt.lessonId, exerciseId, exerciseTitle: exercise.data()?.title ?? "Bài tập 1", status: attempt.status, answeredCount: attempt.answeredCount, correctCount: attempt.correctCount, total: attempt.questionIds.length }, questions, answers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
