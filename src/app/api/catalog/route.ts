import { ApiError, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { PAGE_SIZE, pageToken } from "@/lib/pagination";
import { Attempt, Lesson, Topic } from "@/lib/models";
import { isListeningKind, ListeningAttempt, ListeningSet } from "@/lib/listening";
import { cachedTopics, cachedLessons, cachedListening } from "@/lib/cached-content";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireViewer(), store = db(), params = new URL(request.url).searchParams;
    const kind = params.get("kind"), token = pageToken(request);
    if (kind === "topics") {
      const search = (params.get("search") ?? "").trim();
      if (search.length > 120) throw new ApiError(400, "Từ khóa quá dài.");
      const page = await cachedTopics(PAGE_SIZE, token, search);
      const summaries = page.items.length ? await store.getAll(...page.items.map(d => store.collection("topicProgress").doc(`${user.uid}_${d.id}`))) : [];
      const items = page.items.map((d, i) => {
        const topic = d as unknown as Topic, summary = summaries[i].data();
        return { id: d.id, title: topic.title, total: topic.activeCount ?? 0, remembered: summary?.remembered ?? 0, toReview: summary?.review ?? 0 };
      });
      return Response.json({ items, nextPageToken: page.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (kind === "lessons") {
      const grammarKind = params.get("grammarKind") ?? "theory";
      if (grammarKind !== "theory" && grammarKind !== "practice") throw new ApiError(400, "Loại bài ngữ pháp không hợp lệ.");
      const page = await cachedLessons(PAGE_SIZE, token, grammarKind);
      const items = await Promise.all(page.items.map(async d => {
        const lesson = d as unknown as Lesson;
        const latest = await store.collection("quizAttempts").where("uid", "==", user.uid).where("lessonId", "==", d.id).orderBy("startedAt", "desc").limit(1).get();
        const attempt = latest.docs[0]?.data() as Attempt | undefined;
        return { id: d.id, title: lesson.title, kind: lesson.kind, total: lesson.activeCount ?? 0, lastAttempt: attempt ? { id: latest.docs[0].id, status: attempt.status, correct: attempt.correctCount, answered: attempt.answeredCount, total: attempt.questionIds.length } : null };
      }));
      return Response.json({ items, nextPageToken: page.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (kind === "listening") {
      const listeningKind = params.get("listeningKind");
      if (listeningKind !== null && !isListeningKind(listeningKind)) throw new ApiError(400, "Dạng listening không hợp lệ.");
      const page = await cachedListening(PAGE_SIZE, token, listeningKind ?? undefined);
      const items = await Promise.all(page.items.map(async d => {
        const set = d as unknown as ListeningSet;
        const latest = await store.collection("listeningAttempts").where("uid", "==", user.uid).where("setId", "==", d.id).orderBy("completedAt", "desc").limit(1).get();
        const attempt = latest.docs[0]?.data() as ListeningAttempt | undefined;
        return { id: d.id, title: set.title, kind: set.kind, total: set.activeCount ?? 0, lastAttempt: attempt ? { correct: attempt.correct, total: attempt.total } : null };
      }));
      return Response.json({ items, nextPageToken: page.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } });
    }
    throw new ApiError(400, "Danh sách không hợp lệ.");
  } catch (error) { return jsonError(error); }
}
