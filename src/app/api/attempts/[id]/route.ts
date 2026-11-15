import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { Answer, Attempt, Question } from "@/lib/models";
import { cachedExercise, exerciseQuestions } from "@/lib/cached-content";

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
      cachedExercise(exerciseId),
    ]);
    const saved = new Map(answerSnap.docs.map(doc => { const answer = doc.data() as Answer; return [answer.questionId, answer] as const; }));
    const unansweredIds = attempt.questionIds.filter(questionId => !saved.has(questionId));
    const batchContent = attempt.gradingMode === "batch" && attempt.status === "in_progress" ? await exerciseQuestions(exerciseId) : null;
    if (batchContent && attempt.status === "in_progress" && batchContent.version !== attempt.questionVersion) throw new ApiError(409, "Đề đã thay đổi. Hãy bắt đầu lượt mới.");
    const questionDocs = !batchContent && unansweredIds.length ? await store.getAll(...unansweredIds.map(questionId => store.collection("grammarQuestions").doc(questionId))) : [];
    const unanswered = new Map(batchContent ? batchContent.questions.map(q => [q.id, q] as const) : questionDocs.map(doc => [doc.id, doc.data() as Question | undefined] as const));
    const questions = attempt.questionIds.map(questionId => {
      const answer = saved.get(questionId);
      const source = answer?.snapshot ?? unanswered.get(questionId);
      if (!source) throw new ApiError(409, "Một câu hỏi của lượt này không còn tồn tại.");
      return { id: questionId, question: source.question, A: source.A, B: source.B, C: source.C, D: source.D,
        ...(batchContent && attempt.status === "in_progress" ? { correctAnswer: source.correctAnswer, explanation: source.explanation } : {}) };
    });
    const answers = attempt.questionIds.flatMap(questionId => {
      const answer = saved.get(questionId);
      return answer ? [{ questionId, selected: answer.selected, correct: answer.correct, snapshot: answer.snapshot }] : [];
    });
    return Response.json({ attempt: { id, lessonId: attempt.lessonId, exerciseId, exerciseTitle: (exercise as { title?: string } | null)?.title ?? "Bài tập 1", status: attempt.status, answeredCount: attempt.answeredCount, correctCount: attempt.correctCount, total: attempt.questionIds.length, gradingMode: attempt.gradingMode ?? "legacy" }, questions, answers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
