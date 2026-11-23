import { ApiError, requireContentEditor } from "@/lib/auth";
import { jsonError, nullableArchive, requireCsrf, textField } from "@/lib/api";
import { db } from "@/lib/firebase-admin";
import { driveLink, ListeningItem, ListeningSet } from "@/lib/listening";
import { countChange } from "@/lib/content-counts";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    await requireCsrf(); const user = await requireContentEditor();
    const { kind, id } = await context.params;
    if (kind !== "set" && kind !== "item") throw new ApiError(400, "Loại nội dung không hợp lệ.");
    const store = db(), ref = store.collection(kind === "set" ? "listeningSets" : "listeningItems").doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new ApiError(404, "Không tìm thấy nội dung.");
    const body = await request.json();
    if (typeof body.archive === "boolean") {
      if (user.isBot) throw new ApiError(403, "Bot không được ẩn hoặc khôi phục nội dung.");
      const archivedAt = nullableArchive(body.archive);
      if (kind === "item") {
        await store.runTransaction(async tx => {
          const current = await tx.get(ref);
          if (!current.exists) throw new ApiError(404, "Không tìm thấy câu.");
          const item = current.data() as ListeningItem;
          const change = countChange(item, { archivedAt });
          if (!change.activeCount) return;
          tx.update(ref, { archivedAt });
          tx.update(store.collection("listeningSets").doc(item.setId), { activeCount: FieldValue.increment(change.activeCount) });
        });
      } else await ref.update({ archivedAt });
    } else if (kind === "set") {
      await ref.update({ title: textField(body.title, "Tên bài", 120) });
    } else {
      const item = doc.data() as ListeningItem;
      const set = await store.collection("listeningSets").doc(item.setId).get();
      if (!set.exists) throw new ApiError(409, "Bài học không còn tồn tại.");
      const { kind: setKind } = set.data() as ListeningSet;
      const audioUrl = driveLink(textField(body.audioUrl, "Link audio", 1000)).viewUrl;
      const imageUrl = setKind === "picture" ? driveLink(textField(body.imageUrl, "Link ảnh", 1000)).viewUrl : undefined;
      const key = `${imageUrl ?? ""}\u0000${audioUrl}`;
      if (key !== item.key) {
        const duplicate = await store.collection("listeningItems").where("setId", "==", item.setId).where("key", "==", key).limit(1).get();
        if (!duplicate.empty) throw new ApiError(409, "Media đã có trong bài.");
      }
      if (setKind === "dictation") await ref.update({ audioUrl, transcript: textField(body.transcript, "Câu chép", 1000), key });
      else if (setKind === "picture") {
        const correctAnswer = typeof body.correctAnswer === "string" ? body.correctAnswer.trim().toUpperCase() : "";
        if (!["A", "B", "C", "D"].includes(correctAnswer)) throw new ApiError(400, "Đáp án đúng không hợp lệ.");
        await ref.update({ imageUrl, audioUrl, A: textField(body.A, "A", 1000), B: textField(body.B, "B", 1000), C: textField(body.C, "C", 1000), D: textField(body.D, "D", 1000), correctAnswer, key });
      } else {
        const correctAnswer = typeof body.correctAnswer === "string" ? body.correctAnswer.trim().toUpperCase() : "";
        if (!["A", "B", "C"].includes(correctAnswer)) throw new ApiError(400, "Đáp án đúng phải là A, B hoặc C.");
        await ref.update({
          audioUrl,
          question: textField(body.question, "Câu hỏi", 1000),
          A: textField(body.A, "A", 1000),
          B: textField(body.B, "B", 1000),
          C: textField(body.C, "C", 1000),
          correctAnswer,
          explanation: textField(body.explanation, "Giải thích", 1000),
          translation: textField(body.translation, "Câu dịch", 1000),
          key,
        });
      }
    }
    revalidateTag("content:listening");
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
