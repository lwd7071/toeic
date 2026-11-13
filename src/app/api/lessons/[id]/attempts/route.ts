import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Exercise, Lesson, Question, now } from "@/lib/models";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const { exerciseId } = await request.json();
    if (typeof exerciseId !== "string" || !exerciseId) throw new ApiError(400, "Hãy chọn bài tập.");
    const store = db();
    const lesson = await store.collection("grammarLessons").doc(id).get();
    if (!lesson.exists || !active(lesson.data() as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const exercise = await store.collection("grammarExercises").doc(exerciseId).get();
    if (!exercise.exists || !active(exercise.data() as Exercise) || exercise.data()?.lessonId !== id) throw new ApiError(404, "Không tìm thấy bài tập.");
    const snap = await store.collection("grammarQuestions").where("exerciseId", "==", exerciseId).get();
    const questionIds = snap.docs.filter(d => active(d.data() as Question) && d.data().lessonId === id).sort((a, b) => (a.data().createdAt as string).localeCompare(b.data().createdAt as string)).map(d => d.id);
    if (!questionIds.length) throw new ApiError(400, "Bài tập chưa có câu hỏi.");
    const attempt: Attempt = { uid: user.uid, lessonId: id, exerciseId, questionIds, answeredCount: 0, correctCount: 0, status: "in_progress", startedAt: now(), completedAt: null };
    const ref = await store.collection("quizAttempts").add(attempt);
    return Response.json({ id: ref.id });
  } catch (error) { return jsonError(error); }
}
