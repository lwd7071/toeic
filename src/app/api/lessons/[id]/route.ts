import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Exercise, Lesson } from "@/lib/models";
import { firestorePage, pageToken } from "@/lib/pagination";
import { cachedLesson, cachedExercises } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const lesson = await cachedLesson(id) as (Lesson & { id: string }) | null;
    if (!lesson || !active(lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const { items, nextPageToken } = await cachedExercises(id, pageToken(request));
    const exercises = await Promise.all(items.map(async item => {
      const exercise = item as Exercise & { id: string };
      const latest = await store.collection("quizAttempts").where("uid", "==", user.uid).where("exerciseId", "==", exercise.id).orderBy("startedAt", "desc").limit(1).get();
      const attempt = latest.docs[0]?.data() as Attempt | undefined;
      return { id: exercise.id, title: exercise.title, questionCount: exercise.activeCount ?? 0, lastAttempt: attempt ? { status: attempt.status, correct: attempt.correctCount, answered: attempt.answeredCount, total: attempt.questionIds.length } : null };
    }));
    return Response.json({ lesson, exercises, nextPageToken, questionCount: lesson.activeCount ?? 0 });
  } catch (error) { return jsonError(error); }
}
