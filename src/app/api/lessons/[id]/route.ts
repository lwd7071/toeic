import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Attempt, Exercise, Lesson, Question } from "@/lib/models";
import { PAGE_SIZE, pageToken } from "@/lib/pagination";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireViewer();
    const { id } = await context.params;
    const store = db();
    const doc = await store.collection("grammarLessons").doc(id).get();
    if (!doc.exists || !active(doc.data() as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const [exercisesSnap, questionsSnap, attemptsSnap] = await Promise.all([
      store.collection("grammarExercises").where("lessonId", "==", id).get(),
      store.collection("grammarQuestions").where("lessonId", "==", id).get(),
      store.collection("quizAttempts").where("uid", "==", user.uid).get(),
    ]);
    const questions = questionsSnap.docs.map(d => d.data() as Question).filter(active);
    const attempts = attemptsSnap.docs.map(d => d.data() as Attempt).filter(a => a.lessonId === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const exercises = exercisesSnap.docs.map(d => ({ id: d.id, ...d.data() as Exercise })).filter(active).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(e => {
      const lastAttempt = attempts.find(a => (a.exerciseId ?? `default_${id}`) === e.id);
      return { id: e.id, title: e.title, questionCount: questions.filter(q => q.exerciseId === e.id).length, lastAttempt: lastAttempt ? { status: lastAttempt.status, correct: lastAttempt.correctCount, answered: lastAttempt.answeredCount, total: lastAttempt.questionIds.length } : null };
    });
    const token = pageToken(request), start = token ? exercises.findIndex(e => e.id === token) + 1 : 0;
    if (token && start === 0) throw new ApiError(400, "Trang không hợp lệ.");
    const page = exercises.slice(start, start + PAGE_SIZE);
    return Response.json({ lesson: { id, ...doc.data() }, exercises: page, nextPageToken: exercises.length > start + PAGE_SIZE ? page.at(-1)!.id : null, questionCount: exercises.reduce((n, e) => n + e.questionCount, 0) });
  } catch (error) { return jsonError(error); }
}
