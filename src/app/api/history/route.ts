import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { PAGE_SIZE, pageToken } from "@/lib/pagination";
import { Attempt, Exercise, Lesson } from "@/lib/models";
import { ListeningAttempt } from "@/lib/listening";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireViewer(), store = db(), token = pageToken(request);
    const [grammarSnap, listeningSnap, lessonsSnap, exercisesSnap] = await Promise.all([
      store.collection("quizAttempts").where("uid", "==", user.uid).get(),
      store.collection("listeningAttempts").where("uid", "==", user.uid).get(),
      store.collection("grammarLessons").get(), store.collection("grammarExercises").get(),
    ]);
    const lessons = new Map(lessonsSnap.docs.map(d => [d.id, (d.data() as Lesson).title]));
    const exercises = new Map(exercisesSnap.docs.map(d => [d.id, (d.data() as Exercise).title]));
    const items = [
      ...grammarSnap.docs.map(d => { const a = d.data() as Attempt; return { id: d.id, kind: "grammar" as const, title: `${lessons.get(a.lessonId) ?? "Bài đã ẩn"} · ${exercises.get(a.exerciseId ?? `default_${a.lessonId}`) ?? "Bài tập 1"}`, correct: a.correctCount, total: a.questionIds.length, answered: a.answeredCount, status: a.status, at: a.startedAt }; }),
      ...listeningSnap.docs.map(d => { const a = d.data() as ListeningAttempt; return { id: d.id, kind: "listening" as const, title: a.title, correct: a.correct, total: a.total, answered: a.total, status: "complete", at: a.completedAt }; }),
    ].sort((a, b) => b.at.localeCompare(a.at) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    const start = token ? items.findIndex(item => `${item.kind}_${item.id}` === token) + 1 : 0;
    if (token && start === 0) throw new ApiError(400, "Trang không hợp lệ.");
    const page = items.slice(start, start + PAGE_SIZE);
    return Response.json({ items: page, nextPageToken: items.length > start + PAGE_SIZE ? `${page.at(-1)!.kind}_${page.at(-1)!.id}` : null, grammarCompleted: grammarSnap.docs.filter(d => (d.data() as Attempt).status === "complete").length, listeningCompleted: listeningSnap.size });
  } catch (error) { return jsonError(error); }
}
