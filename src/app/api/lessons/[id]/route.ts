import { requireViewer, ApiError } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { active, Lesson, Question } from "@/lib/models";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireViewer();
    const { id } = await context.params;
    const store = db();
    const doc = await store.collection("grammarLessons").doc(id).get();
    if (!doc.exists || !active(doc.data() as Lesson)) throw new ApiError(404, "Không tìm thấy bài học.");
    const questions = await store.collection("grammarQuestions").where("lessonId", "==", id).get();
    return Response.json({ lesson: { id, ...doc.data() }, questionCount: questions.docs.filter(d => active(d.data() as Question)).length });
  } catch (error) { return jsonError(error); }
}
