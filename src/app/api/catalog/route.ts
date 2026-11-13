import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { PAGE_SIZE, firestorePage, pageToken } from "@/lib/pagination";
import { Card, Exercise, Lesson, Question, Topic, Attempt, active } from "@/lib/models";
import { ListeningAttempt, ListeningItem, ListeningSet } from "@/lib/listening";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireViewer(), store = db(), params = new URL(request.url).searchParams;
    const kind = params.get("kind"), token = pageToken(request);
    if (kind === "topics") {
      const search = (params.get("search") ?? "").trim().toLocaleLowerCase("vi");
      if (search.length > 120) throw new ApiError(400, "Từ khóa quá dài.");
      let docs: FirebaseFirestore.QueryDocumentSnapshot[], nextPageToken: string | null;
      if (search) {
        const all = (await store.collection("vocabTopics").orderBy("__name__").get()).docs.filter(d => active(d.data() as Topic) && (d.data() as Topic).title.toLocaleLowerCase("vi").includes(search));
        const start = token ? all.findIndex(d => d.id === token) + 1 : 0;
        if (token && start === 0) throw new ApiError(400, "Trang không hợp lệ.");
        docs = all.slice(start, start + PAGE_SIZE);
        nextPageToken = all.length > start + PAGE_SIZE ? docs.at(-1)!.id : null;
      } else {
        ({ docs, nextPageToken } = await firestorePage(store.collection("vocabTopics").where("archivedAt", "==", null), token));
      }
      const progressSnap = await store.collection("cardProgress").where("uid", "==", user.uid).get();
      const progress = new Map(progressSnap.docs.map(d => [d.data().cardId as string, d.data().status as string]));
      const items = await Promise.all(docs.map(async d => {
        const cards = (await store.collection("vocabCards").where("topicId", "==", d.id).get()).docs.filter(c => active(c.data() as Card));
        return { id: d.id, title: (d.data() as Topic).title, total: cards.length, remembered: cards.filter(c => progress.get(c.id) === "remembered").length, toReview: cards.filter(c => progress.get(c.id) === "review").length };
      }));
      return Response.json({ items, nextPageToken });
    }
    if (kind === "lessons") {
      const { docs, nextPageToken } = await firestorePage(store.collection("grammarLessons").where("archivedAt", "==", null), token);
      const attemptsSnap = await store.collection("quizAttempts").where("uid", "==", user.uid).get();
      const attempts = attemptsSnap.docs.map(a => ({ id: a.id, ...a.data() as Attempt }));
      const items = await Promise.all(docs.map(async d => {
        const [questions, exercises] = await Promise.all([
          store.collection("grammarQuestions").where("lessonId", "==", d.id).get(),
          store.collection("grammarExercises").where("lessonId", "==", d.id).get(),
        ]);
        const activeExercises = new Set(exercises.docs.filter(e => active(e.data() as Exercise)).map(e => e.id));
        const last = attempts.filter(a => a.lessonId === d.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
        return { id: d.id, title: (d.data() as Lesson).title, total: questions.docs.filter(q => active(q.data() as Question) && activeExercises.has((q.data() as Question).exerciseId)).length, lastAttempt: last ? { id: last.id, status: last.status, correct: last.correctCount, answered: last.answeredCount, total: last.questionIds.length } : null };
      }));
      return Response.json({ items, nextPageToken });
    }
    if (kind === "listening") {
      const { docs, nextPageToken } = await firestorePage(store.collection("listeningSets").where("archivedAt", "==", null), token);
      const attemptsSnap = await store.collection("listeningAttempts").where("uid", "==", user.uid).get();
      const attempts = attemptsSnap.docs.map(a => ({ id: a.id, ...a.data() as ListeningAttempt }));
      const items = await Promise.all(docs.map(async d => {
        const questions = await store.collection("listeningItems").where("setId", "==", d.id).get();
        const last = attempts.filter(a => a.setId === d.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
        const set = d.data() as ListeningSet;
        return { id: d.id, title: set.title, kind: set.kind, total: questions.docs.filter(q => active(q.data() as ListeningItem)).length, lastAttempt: last ? { correct: last.correct, total: last.total } : null };
      }));
      return Response.json({ items, nextPageToken });
    }
    throw new ApiError(400, "Danh sách không hợp lệ.");
  } catch (error) { return jsonError(error); }
}
