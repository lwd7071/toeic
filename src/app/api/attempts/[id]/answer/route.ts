import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { Answer, Attempt, Question, now } from "@/lib/models";
import { qualifiedDay, studyDayRef } from "@/lib/study-store";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const body = await request.json();
    const selected = body.selected;
    const questionId = body.questionId;
    if (!["A", "B", "C", "D"].includes(selected) || typeof questionId !== "string") throw new ApiError(400, "Lựa chọn không hợp lệ.");
    const store = db();
    const attemptRef = store.collection("quizAttempts").doc(id);
    const answerRef = store.collection("quizAnswers").doc(`${id}_${questionId}`);
    const result = await store.runTransaction(async transaction => {
      const attemptDoc = await transaction.get(attemptRef);
      const attempt = attemptDoc.data() as Attempt | undefined;
      if (!attempt || attempt.uid !== user.uid) throw new ApiError(404, "Không tìm thấy lượt làm bài.");
      if (attempt.gradingMode === "batch") throw new ApiError(400, "Lượt này cần nộp cả bài.");
      if (!attempt.questionIds.includes(questionId)) throw new ApiError(409, "Câu hỏi không thuộc lượt làm bài này.");
      const existing = await transaction.get(answerRef);
      if (existing.exists) {
        const answer = existing.data() as Answer;
        if (answer.selected !== selected) throw new ApiError(409, "Câu này đã được trả lời.");
        return { answer: { questionId, selected: answer.selected, correct: answer.correct, snapshot: answer.snapshot }, answeredCount: attempt.answeredCount, correctCount: attempt.correctCount, complete: attempt.status === "complete" };
      }
      if (attempt.status !== "in_progress") throw new ApiError(409, "Lượt làm bài đã hoàn thành.");
      const questionDoc = await transaction.get(store.collection("grammarQuestions").doc(questionId));
      const question = questionDoc.data() as Question | undefined;
      if (!question) throw new ApiError(409, "Câu hỏi không còn tồn tại.");
      const correct = selected === question.correctAnswer;
      const answer: Answer = { attemptId: id, uid: user.uid, questionId, selected, correct, snapshot: { question: question.question, A: question.A, B: question.B, C: question.C, D: question.D, correctAnswer: question.correctAnswer, explanation: question.explanation }, answeredAt: now() };
      const count = attempt.answeredCount + 1;
      const complete = count === attempt.questionIds.length;
      const completedAt = complete ? now() : null;
      const day = complete ? qualifiedDay(new Date(completedAt!)) : null;
      const dayRef = day ? studyDayRef(user.uid, day.date) : null;
      const dayDoc = dayRef ? await transaction.get(dayRef) : null;
      transaction.create(answerRef, answer);
      transaction.update(attemptRef, { answeredCount: count, correctCount: attempt.correctCount + Number(correct), status: complete ? "complete" : "in_progress", completedAt });
      if (dayRef && !dayDoc?.exists) transaction.create(dayRef, { completedAt: day!.at });
      return { answer: { questionId, selected, correct, snapshot: answer.snapshot }, answeredCount: count, correctCount: attempt.correctCount + Number(correct), complete };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
