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
    const answers = (await store.collection("quizAnswers").where("attemptId", "==", id).get()).docs.map(d => d.data() as Answer).sort((a, b) => attempt.questionIds.indexOf(a.questionId) - attempt.questionIds.indexOf(b.questionId));
    let current = null;
    if (attempt.status === "in_progress") {
      const questionId = attempt.questionIds[attempt.answeredCount];
      const question = (await store.collection("grammarQuestions").doc(questionId).get()).data() as Question | undefined;
      if (!question) throw new ApiError(409, "Câu hỏi của lượt này không còn tồn tại.");
      current = { id: questionId, question: question.question, A: question.A, B: question.B, C: question.C, D: question.D };
    }
    return Response.json({ attempt: { id, lessonId: attempt.lessonId, status: attempt.status, answeredCount: attempt.answeredCount, correctCount: attempt.correctCount, total: attempt.questionIds.length }, current, answers });
  } catch (error) { return jsonError(error); }
}
