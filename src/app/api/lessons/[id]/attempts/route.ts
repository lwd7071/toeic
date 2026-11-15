import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Exercise, Lesson, Question, now } from "@/lib/models";
import { cachedLesson, cachedExercise, exerciseQuestions } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const { exerciseId } = await request.json();
    if (typeof exerciseId !== "string" || !exerciseId) throw new ApiError(400, "Hãy chọn bài tập.");
    const store = db();
    const [lesson, exercise, content] = await Promise.all([cachedLesson(id), cachedExercise(exerciseId), exerciseQuestions(exerciseId)]);
    if (!lesson || !active(lesson as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    if (!exercise || !active(exercise as Exercise) || (exercise as Exercise).lessonId !== id) throw new ApiError(404, "Không tìm thấy bài tập.");
    const questionIds = content.questions.filter(q => q.lessonId === id).map(q => q.id);
    if (!questionIds.length) throw new ApiError(400, "Bài tập chưa có câu hỏi.");
    const attempt: Attempt = { uid: user.uid, lessonId: id, exerciseId, questionIds, answeredCount: 0, correctCount: 0, status: "in_progress", startedAt: now(), completedAt: null,
      ...(questionIds.length <= 200 ? { gradingMode: "batch" as const, questionVersion: content.version } : {}) };
    const ref = await store.collection("quizAttempts").add(attempt);
    return Response.json({ id: ref.id });
  } catch (error) { return jsonError(error); }
}
