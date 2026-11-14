import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { PAGE_SIZE } from "@/lib/pagination";
import { Attempt, Exercise, Lesson } from "@/lib/models";
import { ListeningAttempt } from "@/lib/listening";

type Cursor = [string, string] | null;
function cursorToken(request: Request): { g: Cursor; l: Cursor } {
  const raw = new URL(request.url).searchParams.get("pageToken");
  if (!raw) return { g: null, l: null };
  try {
    if (raw.length > 500 || !/^[\w-]+$/.test(raw)) throw new Error();
    const value = JSON.parse(Buffer.from(raw, "base64url").toString()) as { g: Cursor; l: Cursor };
    for (const cursor of [value.g, value.l]) if (cursor !== null && (!Array.isArray(cursor) || cursor.length !== 2 || !Number.isFinite(Date.parse(cursor[0])) || !/^[\w-]+$/.test(cursor[1]))) throw new Error();
    return value;
  } catch { throw new ApiError(400, "Trang không hợp lệ."); }
}

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireViewer(), store = db(), cursor = cursorToken(request);
    const grammar = store.collection("quizAttempts").where("uid", "==", user.uid).orderBy("startedAt", "desc").orderBy("__name__", "desc");
    const listening = store.collection("listeningAttempts").where("uid", "==", user.uid).orderBy("completedAt", "desc").orderBy("__name__", "desc");
    const [grammarSnap, listeningSnap, grammarCount, listeningCount] = await Promise.all([
      (cursor.g ? grammar.startAfter(...cursor.g) : grammar).limit(PAGE_SIZE + 1).get(),
      (cursor.l ? listening.startAfter(...cursor.l) : listening).limit(PAGE_SIZE + 1).get(),
      store.collection("quizAttempts").where("uid", "==", user.uid).where("status", "==", "complete").count().get(),
      store.collection("listeningAttempts").where("uid", "==", user.uid).count().get(),
    ]);
    const ordered = [
      ...grammarSnap.docs.map(d => ({ id: d.id, kind: "grammar" as const, at: (d.data() as Attempt).startedAt, data: d.data() as Attempt })),
      ...listeningSnap.docs.map(d => ({ id: d.id, kind: "listening" as const, at: (d.data() as ListeningAttempt).completedAt, data: d.data() as ListeningAttempt })),
    ].sort((a, b) => b.at.localeCompare(a.at) || a.kind.localeCompare(b.kind) || b.id.localeCompare(a.id));
    const page = ordered.slice(0, PAGE_SIZE);
    const lessonIds = [...new Set(page.filter(a => a.kind === "grammar").map(a => (a.data as Attempt).lessonId))];
    const exerciseIds = [...new Set(page.filter(a => a.kind === "grammar").map(a => { const attempt = a.data as Attempt; return attempt.exerciseId ?? `default_${attempt.lessonId}`; }))];
    const [lessonDocs, exerciseDocs] = await Promise.all([
      lessonIds.length ? store.getAll(...lessonIds.map(id => store.collection("grammarLessons").doc(id))) : [],
      exerciseIds.length ? store.getAll(...exerciseIds.map(id => store.collection("grammarExercises").doc(id))) : [],
    ]);
    const lessons = new Map(lessonDocs.map(d => [d.id, (d.data() as Lesson | undefined)?.title]));
    const exercises = new Map(exerciseDocs.map(d => [d.id, (d.data() as Exercise | undefined)?.title]));
    const items = page.map(a => a.kind === "grammar" ? (() => {
      const attempt = a.data as Attempt;
      return { id: a.id, kind: a.kind, title: `${lessons.get(attempt.lessonId) ?? "Bài đã ẩn"} · ${exercises.get(attempt.exerciseId ?? `default_${attempt.lessonId}`) ?? "Bài tập 1"}`, correct: attempt.correctCount, total: attempt.questionIds.length, answered: attempt.answeredCount, status: attempt.status, at: a.at };
    })() : (() => {
      const attempt = a.data as ListeningAttempt;
      return { id: a.id, kind: a.kind, title: attempt.title, correct: attempt.correct, total: attempt.total, answered: attempt.total, status: "complete", at: a.at };
    })());
    const next = { ...cursor };
    for (const a of page) next[a.kind === "grammar" ? "g" : "l"] = [a.at, a.id];
    return Response.json({ items, nextPageToken: ordered.length > PAGE_SIZE ? Buffer.from(JSON.stringify(next)).toString("base64url") : null, grammarCompleted: grammarCount.data().count, listeningCompleted: listeningCount.data().count });
  } catch (error) { return jsonError(error); }
}
