import { ApiError, requireContentEditor } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { CardRow, ImportKind, parseImport, QuestionRow, uniqueId } from "@/lib/csv-import";
import { now } from "@/lib/models";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { assertDeckSize, VocabDeck } from "@/lib/vocab-deck";

export const runtime = "nodejs";

async function handle(request: Request, commit: boolean) {
  try {
    await requireCsrf();
    await requireContentEditor();
    const form = await request.formData();
    const kind = form.get("kind");
    const parentId = form.get("parentId");
    const file = form.get("file");
    if ((kind !== "cards" && kind !== "questions") || typeof parentId !== "string" || !parentId || !(file instanceof File)) throw new ApiError(400, "Thiếu loại nội dung, bài học hoặc file CSV.");
    const typedKind = kind as ImportKind;
    const parsed = parseImport(Buffer.from(await file.arrayBuffer()), typedKind);
    if (commit && form.get("expectedHash") !== parsed.hash) throw new ApiError(409, "File đã thay đổi từ lúc xem trước. Hãy xem trước lại.");
    const store = db();
    const parentRef = store.collection(kind === "cards" ? "vocabTopics" : "grammarExercises").doc(parentId);
    const parent = await parentRef.get();
    if (!parent.exists || parent.data()?.archivedAt) throw new ApiError(404, "Chủ đề hoặc bài học đã bị ẩn.");
    const lessonId = kind === "questions" ? parent.data()?.lessonId as string : null;
    const lessonRef = lessonId ? store.collection("grammarLessons").doc(lessonId) : null;
    if (lessonRef) { const lesson = await lessonRef.get(); if (!lesson.exists || lesson.data()?.archivedAt) throw new ApiError(404, "Bài ngữ pháp đã bị ẩn."); }
    const markerRefs = parsed.rows.map(row => store.collection("uniqueKeys").doc(uniqueId(typedKind, lessonId ?? parentId, row.key)));
    const errors = [...parsed.errors];
    if (!commit) {
      const matches = await Promise.all(Array.from({ length: Math.ceil(markerRefs.length / 30) }, (_, index) =>
        store.collection("uniqueKeys").where(FieldPath.documentId(), "in", markerRefs.slice(index * 30, index * 30 + 30).map(ref => ref.id)).get()));
      const existing = new Set(matches.flatMap(snapshot => snapshot.docs.map(doc => doc.id)));
      markerRefs.forEach((marker, index) => { if (existing.has(marker.id)) errors.push(`Dòng ${parsed.lines[index]}: nội dung đã có trong bài/chủ đề (có thể đang bị ẩn).`); });
      return Response.json({ hash: parsed.hash, rows: parsed.rows, lines: parsed.lines, errors, count: parsed.rows.length });
    }
    if (errors.length) throw new ApiError(400, errors.join("\n"));
    const collection = store.collection(kind === "cards" ? "vocabCards" : "grammarQuestions");
    const deckRef = kind === "cards" ? store.collection("vocabDecks").doc(parentId) : null;
    try {
      await store.runTransaction(async tx => {
        const parentDoc = await tx.get(parentRef);
        const lessonDoc = lessonRef ? await tx.get(lessonRef) : null;
        const deckDoc = deckRef ? await tx.get(deckRef) : null;
        if (!parentDoc.exists || parentDoc.data()?.archivedAt) throw new ApiError(409, "Chủ đề hoặc bài học đã bị ẩn.");
        if (lessonRef && (!lessonDoc?.exists || lessonDoc.data()?.archivedAt)) throw new ApiError(409, "Bài ngữ pháp đã bị ẩn.");
        if (deckRef && !deckDoc?.exists) throw new ApiError(409, "Bộ thẻ chưa được chuyển dữ liệu.");
        const addedCards: VocabDeck["cards"] = [];
        parsed.rows.forEach((row, index) => {
          const itemRef = collection.doc();
          const common = { archivedAt: null, createdAt: now(), key: row.key };
          const value = kind === "cards"
            ? { ...common, topicId: parentId, english: (row as CardRow).english, vietnamese: (row as CardRow).vietnamese }
            : { ...common, lessonId, exerciseId: parentId, ...(row as QuestionRow) };
          tx.create(itemRef, value);
          if (kind === "cards") addedCards.push({ id: itemRef.id, ...value } as VocabDeck["cards"][number]);
          tx.create(markerRefs[index], { kind, itemId: itemRef.id });
        });
        if (deckRef && deckDoc) {
          const deck = deckDoc.data() as VocabDeck;
          const updated = { ...deck, cards: [...deck.cards, ...addedCards] };
          assertDeckSize(updated);
          tx.update(deckRef, { cards: updated.cards });
        }
        tx.update(parentRef, { totalCount: FieldValue.increment(parsed.rows.length), activeCount: FieldValue.increment(parsed.rows.length) });
        if (lessonRef && lessonDoc && !lessonDoc.data()?.archivedAt) tx.update(lessonRef, { totalCount: FieldValue.increment(parsed.rows.length), activeCount: FieldValue.increment(parsed.rows.length) });
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 6) throw new ApiError(409, "Nội dung vừa được nhập ở nơi khác. Hãy xem trước lại.");
      throw error;
    }
    revalidateTag(kind === "cards" ? "content:topics" : "content:lessons");
    return Response.json({ imported: parsed.rows.length });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) { return handle(request, false); }
export async function PUT(request: Request) { return handle(request, true); }
