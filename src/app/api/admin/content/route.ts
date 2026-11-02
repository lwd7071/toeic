import { requireAdmin, ApiError } from "@/lib/auth";
import { jsonError, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { now } from "@/lib/models";

export const runtime = "nodejs";
export async function GET() {
  try {
    await requireAdmin();
    const store = db();
    const [topics, cards, lessons, questions] = await Promise.all([
      store.collection("vocabTopics").get(), store.collection("vocabCards").get(),
      store.collection("grammarLessons").get(), store.collection("grammarQuestions").get(),
    ]);
    const rows = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return Response.json({ topics: rows(topics), cards: rows(cards), lessons: rows(lessons), questions: rows(questions) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireCsrf();
    await requireAdmin();
    const body = await request.json();
    const title = textField(body.title, "Tên", 120);
    const store = db();
    if (body.kind === "topic") {
      const ref = await store.collection("vocabTopics").add({ title, archivedAt: null, createdAt: now() });
      return Response.json({ id: ref.id });
    }
    if (body.kind === "lesson") {
      const theory = typeof body.theory === "string" ? body.theory.trim().slice(0, 20000) : "";
      const ref = await store.collection("grammarLessons").add({ title, theory, archivedAt: null, createdAt: now() });
      return Response.json({ id: ref.id });
    }
    throw new ApiError(400, "Loại nội dung không hợp lệ.");
  } catch (error) { return jsonError(error); }
}
