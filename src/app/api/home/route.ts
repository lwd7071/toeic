import { requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { Attempt, Exercise, Lesson, Topic } from "@/lib/models";
import { cachedLessons, cachedTopics } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireViewer();
    const store = db();
    const [topicsPage, lessonsPage, attemptSnap, progressDoc] = await Promise.all([
      cachedTopics(3, "", ""),
      cachedLessons(3, ""),
      store.collection("quizAttempts").where("uid", "==", user.uid).where("status", "==", "in_progress").orderBy("startedAt", "desc").limit(1).get(),
      store.collection("userProgress").doc(user.uid).get(),
    ]);
    const attemptDoc = attemptSnap.docs[0];
    const attempt = attemptDoc?.data() as Attempt | undefined;
    // Chạy song song toàn bộ truy vấn phụ thuộc (topicProgress, lesson latest attempts, active exercise)
    const [summaries, lessons, exercise] = await Promise.all([
      topicsPage.items.length ? store.getAll(...topicsPage.items.map(d => store.collection("topicProgress").doc(`${user.uid}_${d.id}`))) : Promise.resolve([]),
      Promise.all(lessonsPage.items.map(async d => {
        const lesson = d as unknown as Lesson;
        const latest = await store.collection("quizAttempts").where("uid", "==", user.uid).where("lessonId", "==", d.id).orderBy("startedAt", "desc").limit(1).get();
        const last = latest.docs[0]?.data() as Attempt | undefined;
        return { id: d.id, title: lesson.title, total: lesson.activeCount ?? 0, lastAttempt: last ? { id: latest.docs[0].id, status: last.status, correct: last.correctCount, answered: last.answeredCount, total: last.questionIds.length } : null };
      })),
      attempt ? store.collection("grammarExercises").doc(attempt.exerciseId ?? `default_${attempt.lessonId}`).get() : Promise.resolve(null),
    ]);
    const topics = topicsPage.items.map((d, i) => {
      const topic = d as unknown as Topic;
      return { id: d.id, title: topic.title, total: topic.activeCount ?? 0, remembered: summaries[i].data()?.remembered ?? 0, toReview: summaries[i].data()?.review ?? 0 };
    });
    const attempts = attempt ? [{ id: attemptDoc.id, lessonId: attempt.lessonId, exerciseTitle: (exercise?.data() as Exercise | undefined)?.title ?? "Bài tập 1", correct: attempt.correctCount, answered: attempt.answeredCount, total: attempt.questionIds.length, status: attempt.status, startedAt: attempt.startedAt }] : [];
    return Response.json({ topics, lessons, attempts, reviewTotal: progressDoc.data()?.review ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
