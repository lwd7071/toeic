import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Lesson, Question, now } from "@/lib/models";

export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const lesson = await store.collection("grammarLessons").doc(id).get();
    if (!lesson.exists || !active(lesson.data() as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const snap = await store.collection("grammarQuestions").where("lessonId", "==", id).get();
    const questionIds = snap.docs.filter(d => active(d.data() as Question)).sort((a, b) => (a.data().createdAt as string).localeCompare(b.data().createdAt as string)).map(d => d.id);
    if (!questionIds.length) throw new ApiError(400, "Bài học chưa có câu hỏi.");
    const attempt: Attempt = { uid: user.uid, lessonId: id, questionIds, answeredCount: 0, correctCount: 0, status: "in_progress", startedAt: now(), completedAt: null };
    const ref = await store.collection("quizAttempts").add(attempt);
    return Response.json({ id: ref.id });
  } catch (error) { return jsonError(error); }
}
