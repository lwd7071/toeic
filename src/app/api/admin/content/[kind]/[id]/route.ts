import { ApiError, requireAdmin } from "@/lib/auth";
import { jsonError, nullableArchive, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { normalizedKey, uniqueId } from "@/lib/csv-import";
import { Card, Question } from "@/lib/models";

export const runtime = "nodejs";
const collections: Record<string, string> = { topic: "vocabTopics", card: "vocabCards", lesson: "grammarLessons", question: "grammarQuestions" };

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    await requireCsrf();
    await requireAdmin();
    const { kind, id } = await context.params;
    const collection = collections[kind];
    if (!collection) throw new ApiError(400, "Loại nội dung không hợp lệ.");
    const body = await request.json();
    const store = db();
    const ref = store.collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new ApiError(404, "Không tìm thấy nội dung.");
    if (typeof body.archive === "boolean") {
      await ref.update({ archivedAt: nullableArchive(body.archive) });
      return Response.json({ ok: true });
    }
    if (kind === "topic") {
      await ref.update({ title: textField(body.title, "Tên chủ đề", 120) });
    } else if (kind === "lesson") {
      const title = textField(body.title, "Tên bài", 120);
      const theory = typeof body.theory === "string" ? body.theory.trim() : "";
      if (theory.length > 20000) throw new ApiError(400, "Lý thuyết quá dài.");
      await ref.update({ title, theory });
    } else if (kind === "card") {
      const card = doc.data() as Card;
      const english = textField(body.english, "Từ tiếng Anh", 1000);
      const vietnamese = textField(body.vietnamese, "Nghĩa tiếng Việt", 1000);
      const key = normalizedKey(english, vietnamese);
      const oldMarker = store.collection("uniqueKeys").doc(uniqueId("cards", card.topicId, card.key));
      const newMarker = store.collection("uniqueKeys").doc(uniqueId("cards", card.topicId, key));
      await store.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (!current.exists) throw new ApiError(404, "Không tìm thấy thẻ.");
        if (key !== card.key) {
          const duplicate = await tx.get(newMarker);
          if (duplicate.exists) throw new ApiError(409, "Cặp từ và nghĩa đã có trong chủ đề.");
          tx.delete(oldMarker);
          tx.create(newMarker, { itemId: id, kind: "cards" });
        }
        tx.update(ref, { english, vietnamese, key });
      });
    } else {
      const question = doc.data() as Question;
      const text = textField(body.question, "Câu hỏi", 1000);
      if ((text.match(/____/g) ?? []).length !== 1) throw new ApiError(400, "Câu hỏi cần đúng một chỗ trống ____. ");
      const A = textField(body.A, "Đáp án A", 1000), B = textField(body.B, "Đáp án B", 1000), C = textField(body.C, "Đáp án C", 1000), D = textField(body.D, "Đáp án D", 1000);
      const explanation = textField(body.explanation, "Giải thích", 1000);
      if (!["A", "B", "C", "D"].includes(body.correctAnswer)) throw new ApiError(400, "Đáp án đúng không hợp lệ.");
      const key = normalizedKey(text);
      const oldMarker = store.collection("uniqueKeys").doc(uniqueId("questions", question.lessonId, question.key));
      const newMarker = store.collection("uniqueKeys").doc(uniqueId("questions", question.lessonId, key));
      await store.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (!current.exists) throw new ApiError(404, "Không tìm thấy câu hỏi.");
        if (key !== question.key) {
          const duplicate = await tx.get(newMarker);
          if (duplicate.exists) throw new ApiError(409, "Câu hỏi đã có trong bài.");
          tx.delete(oldMarker);
          tx.create(newMarker, { itemId: id, kind: "questions" });
        }
        tx.update(ref, { question: text, A, B, C, D, explanation, correctAnswer: body.correctAnswer, key });
      });
    }
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
