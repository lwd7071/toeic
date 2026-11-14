import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Exercise, Lesson } from "@/lib/models";
import { firestorePage, pageToken } from "@/lib/pagination";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const doc = await store.collection("grammarLessons").doc(id).get();
    if (!doc.exists || !active(doc.data() as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const { docs, nextPageToken } = await firestorePage(store.collection("grammarExercises").where("lessonId", "==", id).where("archivedAt", "==", null), pageToken(request));
    const exercises = await Promise.all(docs.map(async d => {
      const exercise = d.data() as Exercise;
      const latest = await store.collection("quizAttempts").where("uid", "==", user.uid).where("exerciseId", "==", d.id).orderBy("startedAt", "desc").limit(1).get();
      const attempt = latest.docs[0]?.data() as Attempt | undefined;
      return { id: d.id, title: exercise.title, questionCount: exercise.activeCount ?? 0, lastAttempt: attempt ? { status: attempt.status, correct: attempt.correctCount, answered: attempt.answeredCount, total: attempt.questionIds.length } : null };
    }));
    return Response.json({ lesson: { id, ...doc.data() }, exercises, nextPageToken, questionCount: (doc.data() as Lesson).activeCount ?? 0 });
  } catch (error) { return jsonError(error); }
}
