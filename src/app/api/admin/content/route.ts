import { requireContentEditor, ApiError } from "@/lib/auth";
import { jsonError, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { now } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireContentEditor();
    const store = db();
    const [topics, cards, lessons, exercises, questions] = await Promise.all([
      store.collection("vocabTopics").get(), store.collection("vocabCards").get(),
      store.collection("grammarLessons").get(), store.collection("grammarExercises").get(), store.collection("grammarQuestions").get(),
    ]);
    const rows = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return Response.json({ topics: rows(topics), cards: rows(cards), lessons: rows(lessons), exercises: rows(exercises), questions: rows(questions), isBot: user.isBot });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireCsrf();
    await requireContentEditor();
    const body = await request.json();
    const title = textField(body.title, "Tên", 120);
    const store = db();
    if (body.kind === "topic") {
      const ref = await store.collection("vocabTopics").add({ title, archivedAt: null, createdAt: now() });
      return Response.json({ id: ref.id });
    }
    if (body.kind === "lesson") {
      const theory = typeof body.theory === "string" ? body.theory.trim().slice(0, 20000) : "";
      const ref = store.collection("grammarLessons").doc();
      const batch = store.batch();
      const createdAt = now();
      batch.create(ref, { title, theory, archivedAt: null, createdAt });
      batch.create(store.collection("grammarExercises").doc(`default_${ref.id}`), { lessonId: ref.id, title: "Bài tập 1", archivedAt: null, createdAt });
      await batch.commit();
      return Response.json({ id: ref.id });
    }
    if (body.kind === "exercise") {
      const lessonId = body.lessonId;
      if (typeof lessonId !== "string" || !lessonId) throw new ApiError(400, "Thiếu bài ngữ pháp.");
      const lesson = await store.collection("grammarLessons").doc(lessonId).get();
      if (!lesson.exists || lesson.data()?.archivedAt) throw new ApiError(404, "Bài ngữ pháp đã bị ẩn.");
      const ref = await store.collection("grammarExercises").add({ lessonId, title, archivedAt: null, createdAt: now() });
      return Response.json({ id: ref.id });
    }
    throw new ApiError(400, "Loại nội dung không hợp lệ.");
  } catch (error) { return jsonError(error); }
}
