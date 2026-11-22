import { ApiError, requireContentEditor } from "@/lib/auth";
import { jsonError, nullableArchive, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { normalizedKey, uniqueId } from "@/lib/csv-import";
import { Card, Question } from "@/lib/models";
import { countChange, searchTitle } from "@/lib/content-counts";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { assertDeckSize, VocabDeck } from "@/lib/vocab-deck";

export const runtime = "nodejs";
const collections: Record<string, string> = { topic: "vocabTopics", card: "vocabCards", lesson: "grammarLessons", exercise: "grammarExercises", question: "grammarQuestions" };

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    await requireCsrf();
    const user = await requireContentEditor();
    const { kind, id } = await context.params;
    const collection = collections[kind];
    if (!collection) throw new ApiError(400, "Loại nội dung không hợp lệ.");
    const body = await request.json();
    const store = db();
    const ref = store.collection(collection).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new ApiError(404, "Không tìm thấy nội dung.");
    if (typeof body.archive === "boolean") {
      if (user.isBot) throw new ApiError(403, "Bot không được ẩn hoặc khôi phục nội dung.");
      const archivedAt = nullableArchive(body.archive);
      if (Boolean(doc.data()?.archivedAt) === Boolean(archivedAt)) return Response.json({ ok: true });
      await store.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (!current.exists) throw new ApiError(404, "Không tìm thấy nội dung.");
        const data = current.data()!;
        const deckRef = kind === "topic" || kind === "card" ? store.collection("vocabDecks").doc(kind === "topic" ? id : data.topicId) : null;
        const deckDoc = deckRef ? await tx.get(deckRef) : null;
        if (deckRef && !deckDoc?.exists) throw new ApiError(409, "Bộ thẻ chưa được chuyển dữ liệu.");
        const change = countChange({ archivedAt: data.archivedAt }, { archivedAt });
        const parentRef = kind === "card" ? store.collection("vocabTopics").doc(data.topicId) : kind === "question" ? store.collection("grammarExercises").doc(data.exerciseId) : kind === "exercise" ? store.collection("grammarLessons").doc(data.lessonId) : null;
        const parent = parentRef ? await tx.get(parentRef) : null;
        const lessonRef = kind === "question" ? store.collection("grammarLessons").doc(data.lessonId) : null;
        const lesson = lessonRef ? await tx.get(lessonRef) : null;
        const progress = kind === "card" ? await tx.get(store.collection("cardProgress").where("cardId", "==", id)) : null;
        const summaries = progress ? await Promise.all(progress.docs.map(p => tx.get(store.collection("topicProgress").doc(`${p.data().uid}_${data.topicId}`)))) : [];
        const topicSummaries = kind === "topic" ? await tx.get(store.collection("topicProgress").where("topicId", "==", id)) : null;
        tx.update(ref, { archivedAt });
        if (deckRef && deckDoc) {
          const deck = deckDoc.data() as VocabDeck;
          if (kind === "topic") tx.update(deckRef, { archivedAt });
          else {
            const cards = deck.cards.map(card => card.id === id ? { ...card, archivedAt } : card);
            tx.update(deckRef, { cards });
          }
        }
        if (parentRef && parent) {
          if (kind === "exercise") tx.update(parentRef, { activeCount: FieldValue.increment(change.activeCount * (data.activeCount ?? 0)) });
          else tx.update(parentRef, { activeCount: FieldValue.increment(change.activeCount) });
        }
        if (lessonRef && lesson && !parent?.data()?.archivedAt) tx.update(lessonRef, { activeCount: FieldValue.increment(change.activeCount) });
        progress?.docs.forEach((p, index) => {
          const status = p.data().status;
          if (status === "remembered" || status === "review") {
            tx.set(summaries[index].ref, { [status]: FieldValue.increment(change.activeCount) }, { merge: true });
            if (!parent?.data()?.archivedAt) tx.set(store.collection("userProgress").doc(p.data().uid), { [status]: FieldValue.increment(change.activeCount) }, { merge: true });
          }
        });
        topicSummaries?.docs.forEach(summary => {
          const values = summary.data();
          tx.set(store.collection("userProgress").doc(values.uid), { remembered: FieldValue.increment(change.activeCount * (values.remembered ?? 0)), review: FieldValue.increment(change.activeCount * (values.review ?? 0)) }, { merge: true });
        });
      });
      revalidateTag(kind === "topic" || kind === "card" ? "content:topics" : "content:lessons");
      return Response.json({ ok: true });
    }
    if (kind === "topic") {
      const title = textField(body.title, "Tên chủ đề", 120);
      await store.runTransaction(async tx => {
        const deckRef = store.collection("vocabDecks").doc(id);
        const deck = await tx.get(deckRef);
        if (!deck.exists) throw new ApiError(409, "Bộ thẻ chưa được chuyển dữ liệu.");
        tx.update(ref, { title, searchTitle: searchTitle(title) });
        tx.update(deckRef, { title });
      });
    } else if (kind === "lesson") {
      const title = textField(body.title, "Tên bài", 120);
      const theory = typeof body.theory === "string" ? body.theory.trim() : "";
      if (theory.length > 20000) throw new ApiError(400, "Lý thuyết quá dài.");
      if (doc.data()?.kind === "practice") {
        if (theory) throw new ApiError(400, "Bài tập thuần không có lý thuyết.");
        const exerciseRef = store.collection("grammarExercises").doc(`default_${id}`);
        await store.runTransaction(async tx => {
          const exercise = await tx.get(exerciseRef);
          if (!exercise.exists) throw new ApiError(409, "Bài tập mặc định không tồn tại.");
          tx.update(ref, { title });
          tx.update(exerciseRef, { title });
        });
      } else await ref.update({ title, theory });
    } else if (kind === "exercise") {
      const lesson = await store.collection("grammarLessons").doc(doc.data()?.lessonId).get();
      if (lesson.data()?.kind === "practice") throw new ApiError(400, "Hãy đổi tên ở bài tập thuần.");
      await ref.update({ title: textField(body.title, "Tên bài tập", 120) });
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
        const deckRef = store.collection("vocabDecks").doc(card.topicId);
        const deckDoc = await tx.get(deckRef);
        if (!deckDoc.exists) throw new ApiError(409, "Bộ thẻ chưa được chuyển dữ liệu.");
        const deck = deckDoc.data() as VocabDeck;
        const cards = deck.cards.map(item => item.id === id ? { ...item, english, vietnamese, key } : item);
        const updated = { ...deck, cards };
        assertDeckSize(updated);
        if (key !== card.key) {
          const duplicate = await tx.get(newMarker);
          if (duplicate.exists) throw new ApiError(409, "Cặp từ và nghĩa đã có trong chủ đề.");
          tx.delete(oldMarker);
          tx.create(newMarker, { itemId: id, kind: "cards" });
        }
        tx.update(ref, { english, vietnamese, key });
        tx.update(deckRef, { cards });
      });
    } else {
      const question = doc.data() as Question;
      const text = textField(body.question, "Câu hỏi", 1000);
      if ((text.match(/____/g) ?? []).length !== 1) throw new ApiError(400, "Câu hỏi cần đúng một chỗ trống ____. ");
      const A = textField(body.A, "Đáp án A", 1000), B = textField(body.B, "Đáp án B", 1000), C = textField(body.C, "Đáp án C", 1000), D = textField(body.D, "Đáp án D", 1000);
      const explanation = textField(body.explanation, "Giải thích", 1000);
      if (body.translation !== undefined && (typeof body.translation !== "string" || body.translation.trim().length > 1000)) throw new ApiError(400, "Câu dịch không hợp lệ.");
      const translation = body.translation?.trim() ?? question.translation ?? "";
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
        tx.update(ref, { question: text, A, B, C, D, explanation, translation, correctAnswer: body.correctAnswer, key });
      });
    }
    revalidateTag(kind === "topic" || kind === "card" ? "content:topics" : "content:lessons");
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
