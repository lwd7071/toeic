import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { exerciseQuestions } from "@/lib/cached-content";
import { Answer, Attempt, now } from "@/lib/models";
import { qualifiedDay, studyDayRef } from "@/lib/study-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const body = await request.json();
    if (!body || !Array.isArray(body.answers) || body.answers.length > 200 || body.answers.some((a: unknown) =>
      !a || typeof a !== "object" || typeof (a as { questionId?: unknown }).questionId !== "string" ||
      !["A", "B", "C", "D"].includes((a as { selected?: string }).selected ?? ""))) throw new ApiError(400, "Câu trả lời không hợp lệ.");
    const selected = new Map<string, Answer["selected"]>();
    for (const answer of body.answers as { questionId: string; selected: Answer["selected"] }[]) {
      if (selected.has(answer.questionId)) throw new ApiError(400, "Câu trả lời bị trùng.");
      selected.set(answer.questionId, answer.selected);
    }
    const store = db(), attemptRef = store.collection("quizAttempts").doc(id);
    const attemptDoc = await attemptRef.get(), attempt = attemptDoc.data() as Attempt | undefined;
    if (!attempt || attempt.uid !== user.uid) throw new ApiError(404, "Không tìm thấy lượt làm bài.");
    if (attempt.gradingMode !== "batch") throw new ApiError(400, "Lượt này lưu từng câu.");
    if (attempt.status !== "in_progress") throw new ApiError(409, "Lượt này đã hoàn thành. Hãy tải lại kết quả.");
    if (selected.size !== attempt.questionIds.length || attempt.questionIds.some(questionId => !selected.has(questionId))) throw new ApiError(400, "Hãy trả lời đủ các câu trong bài.");
    const content = await exerciseQuestions(attempt.exerciseId ?? `default_${attempt.lessonId}`);
    if (content.version !== attempt.questionVersion) throw new ApiError(409, "Đề đã thay đổi. Hãy bắt đầu lượt mới.");
    const questions = new Map(content.questions.map(q => [q.id, q]));
    const answeredAt = now();
    const answers: Answer[] = attempt.questionIds.map(questionId => {
      const question = questions.get(questionId);
      if (!question) throw new ApiError(409, "Một câu hỏi không còn tồn tại.");
      const choice = selected.get(questionId)!;
      return { attemptId: id, uid: user.uid, questionId, selected: choice, correct: choice === question.correctAnswer,
        snapshot: { question: question.question, A: question.A, B: question.B, C: question.C, D: question.D, correctAnswer: question.correctAnswer, explanation: question.explanation, ...(question.translation ? { translation: question.translation } : {}) }, answeredAt };
    });
    const correctCount = answers.filter(a => a.correct).length;
    const day = qualifiedDay(new Date(answeredAt));
    const dayRef = day ? studyDayRef(user.uid, day.date) : null;
    await store.runTransaction(async tx => {
      const current = await tx.get(attemptRef);
      const saved = current.data() as Attempt | undefined;
      const dayDoc = dayRef ? await tx.get(dayRef) : null;
      if (!saved || saved.uid !== user.uid || saved.status !== "in_progress" || saved.gradingMode !== "batch" || saved.questionVersion !== attempt.questionVersion) throw new ApiError(409, "Lượt này đã thay đổi. Hãy tải lại.");
      answers.forEach(answer => tx.create(store.collection("quizAnswers").doc(`${id}_${answer.questionId}`), answer));
      tx.update(attemptRef, { answeredCount: answers.length, correctCount, status: "complete", completedAt: answeredAt });
      if (dayRef && !dayDoc?.exists) tx.create(dayRef, { completedAt: day!.at });
    });
    return Response.json({ answeredCount: answers.length, correctCount, answers });
  } catch (error) { return jsonError(error); }
}
