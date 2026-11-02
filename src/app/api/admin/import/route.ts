import { ApiError, requireAdmin } from "@/lib/auth";
import { jsonError, requireCsrf } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { CardRow, ImportKind, parseImport, QuestionRow, uniqueId } from "@/lib/csv-import";
import { now } from "@/lib/models";

export const runtime = "nodejs";

async function handle(request: Request, commit: boolean) {
  try {
    await requireCsrf();
    await requireAdmin();
    const form = await request.formData();
    const kind = form.get("kind");
    const parentId = form.get("parentId");
    const file = form.get("file");
    if ((kind !== "cards" && kind !== "questions") || typeof parentId !== "string" || !parentId || !(file instanceof File)) throw new ApiError(400, "Thiếu loại nội dung, bài học hoặc file CSV.");
    const typedKind = kind as ImportKind;
    const parsed = parseImport(Buffer.from(await file.arrayBuffer()), typedKind);
    if (commit && form.get("expectedHash") !== parsed.hash) throw new ApiError(409, "File đã thay đổi từ lúc xem trước. Hãy xem trước lại.");
    const store = db();
    const parentRef = store.collection(kind === "cards" ? "vocabTopics" : "grammarLessons").doc(parentId);
    const parent = await parentRef.get();
    if (!parent.exists || parent.data()?.archivedAt) throw new ApiError(404, "Chủ đề hoặc bài học đã bị ẩn.");
    const markerRefs = parsed.rows.map(row => store.collection("uniqueKeys").doc(uniqueId(typedKind, parentId, row.key)));
    const markers = markerRefs.length ? await store.getAll(...markerRefs) : [];
    const errors = [...parsed.errors];
    markers.forEach((marker, index) => { if (marker.exists) errors.push(`Dòng ${index + 2}: nội dung đã có trong bài/chủ đề (có thể đang bị ẩn).`); });
    if (!commit) return Response.json({ hash: parsed.hash, rows: parsed.rows, errors, count: parsed.rows.length });
    if (errors.length) throw new ApiError(400, errors.join("\n"));
    const collection = store.collection(kind === "cards" ? "vocabCards" : "grammarQuestions");
    await store.runTransaction(async tx => {
      const parentDoc = await tx.get(parentRef);
      const uniqueDocs = await Promise.all(markerRefs.map(ref => tx.get(ref)));
      if (!parentDoc.exists || parentDoc.data()?.archivedAt) throw new ApiError(409, "Chủ đề hoặc bài học đã bị ẩn.");
      if (uniqueDocs.some(doc => doc.exists)) throw new ApiError(409, "Nội dung vừa được nhập ở nơi khác. Hãy xem trước lại.");
      parsed.rows.forEach((row, index) => {
        const itemRef = collection.doc();
        const common = { archivedAt: null, createdAt: now(), key: row.key };
        const value = kind === "cards"
          ? { ...common, topicId: parentId, english: (row as CardRow).english, vietnamese: (row as CardRow).vietnamese }
          : { ...common, lessonId: parentId, ...(row as QuestionRow) };
        tx.create(itemRef, value);
        tx.create(markerRefs[index], { kind, itemId: itemRef.id });
      });
    });
    return Response.json({ imported: parsed.rows.length });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) { return handle(request, false); }
export async function PUT(request: Request) { return handle(request, true); }
